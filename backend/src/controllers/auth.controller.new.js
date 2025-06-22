const admin = require('firebase-admin');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { URLSearchParams } = require('url');
const crypto = require('crypto');

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
    
    // Get GitHub data
    const firebaseData = decodedToken.firebase || {};
    if (Object.keys(firebaseData).length > 0) {
      console.log('Firebase auth data available:', Object.keys(firebaseData));
    }
    
    const identities = firebaseData.identities || {};
    if (Object.keys(identities).length > 0) {
      console.log('Firebase identities:', Object.keys(identities));
    }
    
    const hasGithubIdentity = identities && identities['github.com'] && identities['github.com'].length > 0;
    if (hasGithubIdentity) {
      console.log('GitHub identity found');
    }
    
    const githubData = firebaseData.sign_in_attributes || {};
    console.log('GitHub data from token:', githubData);
    
    // Extract user details
    const name = decodedToken.name || githubData.name || 'GitHub User';
    const email = decodedToken.email || githubData.email || null;
    const picture = decodedToken.picture || githubData.picture || githubData.avatar_url || null;
    const githubUsername = githubData.login || null;
    const githubId = identities && identities['github.com'] ? identities['github.com'][0] : null;
    
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
    
    // 4. Create a new user if not found
    if (!user) {
      console.log('No user found in Supabase, creating new user');
      
      // Generate a UUID for the new user
      const uuid = crypto.randomUUID();
      console.log('Generated UUID for new user:', uuid);
      
      // Create the user data
      const userData = {
        id: uuid,
        firebase_uid: uid,
        github_id: githubId,
        github_username: githubUsername,
        name: name,
        email: email,
        avatar_url: picture,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Creating new user with data:', {
        id: userData.id,
        firebase_uid: userData.firebase_uid,
        github_id: userData.github_id,
        github_username: userData.github_username,
        name: userData.name,
        email: userData.email
      });
      
      try {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(userData)
          .select();
        
        if (createError) {
          console.error('Error creating user in Supabase:', createError);
          // Use the userData object as fallback
          user = userData;
        } else if (newUser && newUser.length > 0) {
          console.log('Successfully created user in Supabase');
          user = newUser[0];
        } else {
          console.log('No error but no user returned, using userData as fallback');
          user = userData;
        }
      } catch (createError) {
        console.error('Exception creating user:', createError);
        // Use the userData object as fallback
        user = userData;
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
