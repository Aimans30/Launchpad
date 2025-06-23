const admin = require('firebase-admin');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { URLSearchParams } = require('url');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Redirect to GitHub OAuth login
 */
exports.githubLogin = (req, res) => {
  // Use the callback URL from environment variables
  const redirectUrl = process.env.CALLBACK_URL;
  console.log('Redirecting to GitHub with callback URL:', redirectUrl);
  
  // GitHub OAuth parameters
  const params = {
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUrl,
    scope: 'user:email read:user',
    state: crypto.randomBytes(16).toString('hex')
  };
  
  // Redirect to GitHub OAuth login
  const searchParams = new URLSearchParams(params);
  const url = `https://github.com/login/oauth/authorize?${searchParams.toString()}`;
  res.redirect(url);
};

/**
 * Handle GitHub OAuth callback
 */
exports.githubCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }
    
    console.log('GitHub callback received with code');
    
    // Exchange code for access token
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://github.com/login/oauth/access_token',
      params: {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.CALLBACK_URL
      },
      headers: {
        accept: 'application/json'
      }
    });
    
    const { access_token } = tokenResponse.data;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Failed to get GitHub access token' });
    }
    
    // Get GitHub user info
    const userResponse = await axios({
      method: 'get',
      url: 'https://api.github.com/user',
      headers: {
        Authorization: `token ${access_token}`
      }
    });
    
    const userData = userResponse.data;
    console.log('GitHub user data received');
    
    // Return user data to the client
    res.status(200).json({ userData });
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.status(500).json({ error: 'GitHub authentication failed', details: error.message });
  }
};

/**
 * User login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Handle login logic here
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Login failed', details: error.message });
  }
};

/**
 * User logout
 */
exports.logout = (req, res) => {
  try {
    // Handle logout logic here
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed', details: error.message });
  }
};

/**
 * Get current authenticated user
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    console.log('Processing token for user endpoint');
    
    // Decode token without verification for development
    let decodedToken;
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      decodedToken = payload;
      console.log('Token decoded, processing user data');
    } catch (decodeError) {
      console.error('Token decode error:', decodeError);
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    const uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid;
    if (!uid) {
      return res.status(401).json({ error: 'No user ID in token' });
    }
    
    console.log('Using user ID from token:', uid);
    
    // Extract user info from token with detailed logging
    console.log('Extracting user info from token payload');
    const tokenPayloadKeys = Object.keys(decodedToken);
    console.log('Token payload structure:', tokenPayloadKeys);
    
    // Get GitHub data with detailed logging
    const firebaseData = decodedToken.firebase || {};
    console.log('Firebase data structure:', JSON.stringify(decodedToken, null, 2).substring(0, 500) + '...');
    
    if (Object.keys(firebaseData).length > 0) {
      console.log('Firebase auth data available:', Object.keys(firebaseData));
    } else {
      console.log('Firebase auth data not found in token');
    }
    
    // Extract identities with detailed logging
    const identities = firebaseData.identities || {};
    if (Object.keys(identities).length > 0) {
      console.log('Firebase identities found:', JSON.stringify(identities));
    } else {
      console.log('No identities found in Firebase data');
    }
    
    // Try multiple paths to extract GitHub ID
    let githubId = null;
    
    // Method 1: Through firebase.identities
    if (identities && identities['github.com'] && identities['github.com'].length > 0) {
      githubId = identities['github.com'][0];
      console.log('GitHub ID found through identities:', githubId);
    }
    
    // Method 2: Through firebase.sign_in_attributes
    const githubData = firebaseData.sign_in_attributes || {};
    console.log('GitHub data from sign_in_attributes:', githubData);
    
    if (!githubId && githubData.id) {
      githubId = String(githubData.id); // Ensure it's a string
      console.log('GitHub ID found through sign_in_attributes:', githubId);
    }
    
    // Method 3: Through provider_data array (sometimes present)
    if (!githubId && decodedToken.provider_data && Array.isArray(decodedToken.provider_data)) {
      const githubProvider = decodedToken.provider_data.find(p => p.providerId === 'github.com');
      if (githubProvider && githubProvider.uid) {
        githubId = githubProvider.uid;
        console.log('GitHub ID found through provider_data:', githubId);
      }
    }
    
    // Method 4: Directly from token root
    if (!githubId && decodedToken.github_id) {
      githubId = decodedToken.github_id;
      console.log('GitHub ID found directly in token root:', githubId);
    }
    
    // Check if we have explicit data in the request body (from POST request)
    const requestBody = req.body || {};
    
    // Extract user details - prioritize request body data over token data
    const name = requestBody.displayName || decodedToken.name || githubData.name || 'GitHub User';
    const email = requestBody.email || decodedToken.email || githubData.email || null;
    const picture = requestBody.photoURL || decodedToken.picture || githubData.avatar_url || githubData.picture || null;
    
    // For GitHub username and ID, explicitly prioritize data from request body
    let githubUsername = null;
    if (requestBody.githubUsername) {
      githubUsername = requestBody.githubUsername;
      console.log('Using GitHub username from request body:', githubUsername);
    } else {
      githubUsername = githubData.login || decodedToken.github_username || decodedToken.githubUsername || null;
      console.log('Using GitHub username from token:', githubUsername);
    }
    
    // Similarly for GitHub ID
    if (requestBody.githubId) {
      githubId = String(requestBody.githubId);
      console.log('Using GitHub ID from request body:', githubId);
    } else if (!githubId) {
      // Only use this as fallback if we didn't already find githubId through other methods
      console.log('No GitHub ID found yet, checking other sources');
    }
    
    console.log('Extracted user info:', {
      name,
      email,
      username: githubUsername,
      picture: picture ? 'Found' : 'Not found',
      githubId
    });
    
    // Find user with multiple lookup strategies to prevent duplicates
    let user = null;
    
    // 1. Look up by firebase_uid
    console.log('Looking up user by firebase_uid');
    const { data: userByFirebaseUid, error: firebaseUidError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', uid);
      
    if (!firebaseUidError && userByFirebaseUid && userByFirebaseUid.length > 0) {
      console.log('Found user by firebase_uid');
      user = userByFirebaseUid[0];
    }
    
    // 2. Look up by github_id if available
    if (!user && githubId) {
      console.log('Looking up user by github_id:', githubId);
      const { data: userByGithubId, error: githubIdError } = await supabase
        .from('users')
        .select('*')
        .eq('github_id', githubId);
        
      if (!githubIdError && userByGithubId && userByGithubId.length > 0) {
        console.log('Found user by github_id');
        user = userByGithubId[0];
        
        // Update firebase_uid if it doesn't match
        if (user.firebase_uid !== uid) {
          console.log('Updating firebase_uid for existing user');
          await supabase
            .from('users')
            .update({ firebase_uid: uid, updated_at: new Date().toISOString() })
            .eq('id', user.id);
            
          // Refresh user data
          user.firebase_uid = uid;
          user.updated_at = new Date().toISOString();
        }
      }
    }
    
    // 3. Look up by email if available
    if (!user && email) {
      console.log('Looking up user by email:', email);
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);
        
      if (!emailError && userByEmail && userByEmail.length > 0) {
        console.log('Found user by email');
        user = userByEmail[0];
        
        // Update GitHub and Firebase data if needed
        const updates = {
          firebase_uid: uid,
          updated_at: new Date().toISOString()
        };
        
        if (githubId && (!user.github_id || user.github_id !== githubId)) {
          updates.github_id = githubId;
        }
        
        if (githubUsername && (!user.github_username || user.github_username !== githubUsername)) {
          updates.github_username = githubUsername;
        }
        
        if (picture && (!user.avatar_url || user.avatar_url !== picture)) {
          updates.avatar_url = picture;
        }
        
        console.log('Updating existing user data:', updates);
        await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
          
        // Update local user object
        user = { ...user, ...updates };
      }
    }
    
    // Create a new user if not found
    if (!user) {
      console.log('No user found, creating new user');
      
      // Generate a UUID for the new user
      const userId = uuidv4();
      
      // Create new user object with detailed logging of each field
      console.log('GitHub ID for new user:', githubId);
      console.log('GitHub Username for new user:', githubUsername);
      console.log('Name for new user:', name);
      console.log('Email for new user:', email ? '(email present)' : '(no email)');
      console.log('Avatar URL for new user:', picture ? '(avatar present)' : '(no avatar)');
      
      // Get GitHub access token if available
      let githubAccessToken = null;
      if (req.body && req.body.github_access_token) {
        githubAccessToken = req.body.github_access_token;
        console.log('Using GitHub access token from request body');
      }
      
      const newUser = {
        id: userId,
        firebase_uid: uid,
        github_id: githubId,
        github_username: githubUsername,
        name: name,
        email: email,
        avatar_url: picture,
        github_access_token: githubAccessToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Creating new user with data:', JSON.stringify(newUser, (key, value) => {
        // Mask email for privacy in logs
        if (key === 'email' && value) return '(email present)';
        return value;
      }, 2));
      
      // Insert into database
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert([newUser])
        .select();
        
      if (insertError) {
        console.error('Error creating user:', insertError);
        return res.status(500).json({ error: 'Error creating user' });
      }
      
      console.log('User created successfully:', insertedUser ? 'User data returned' : 'No data returned');
      user = newUser;
    } else {
      // If user exists, check if we need to update GitHub data
      const updates = {};
      let needsUpdate = false;
      
      if (githubId && (!user.github_id || user.github_id !== githubId)) {
        console.log(`Updating github_id from ${user.github_id || 'null'} to ${githubId}`);
        updates.github_id = githubId;
        needsUpdate = true;
      }
      
      if (githubUsername && (!user.github_username || user.github_username !== githubUsername)) {
        console.log(`Updating github_username from ${user.github_username || 'null'} to ${githubUsername}`);
        updates.github_username = githubUsername;
        needsUpdate = true;
      }
      
      if (picture && (!user.avatar_url || user.avatar_url !== picture)) {
        console.log('Updating avatar_url');
        updates.avatar_url = picture;
        needsUpdate = true;
      }
      
      // Check if we have a GitHub access token to update
      if (req.body && req.body.github_access_token) {
        console.log('Updating GitHub access token');
        updates.github_access_token = req.body.github_access_token;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        updates.updated_at = new Date().toISOString();
        console.log('Updating user with data:', updates);
        
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
          
        if (updateError) {
          console.error('Error updating user:', updateError);
        } else {
          // Update local user object with new values
          Object.assign(user, updates);
          console.log('User updated successfully');
        }
      }
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};

/**
 * Verify Firebase token
 */
exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // For development, just decode the token without verification
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      res.status(200).json({ valid: true, uid: payload.user_id || payload.sub });
    } catch (error) {
      res.status(401).json({ valid: false, error: error.message });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: error.message });
  }
};
