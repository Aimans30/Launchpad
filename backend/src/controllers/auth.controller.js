const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

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
  const redirectUrl = process.env.CALLBACK_URL || 'https://launchpad-4a4ac.firebaseapp.com/__/auth/handler';
  console.log('Redirecting to GitHub with callback URL:', redirectUrl);
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUrl}&scope=user:email,repo`);
};

/**
 * Handle GitHub OAuth callback
 */
exports.githubCallback = async (req, res) => {
  const { code } = req.query;
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_auth_failed`);
    }
    
    const accessToken = tokenData.access_token;
    
    // Fetch user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const userData = await userResponse.json();
    
    // Fetch user emails from GitHub
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const emailsData = await emailsResponse.json();
    const primaryEmail = emailsData.find(email => email.primary)?.email || emailsData[0]?.email;
    
    if (!primaryEmail) {
      console.error('No email found for GitHub user');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }
    
    // Check if user exists in Supabase
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', primaryEmail)
      .single();
    
    let userId;
    
    if (findError && findError.code !== 'PGRST116') { // PGRST116 means no rows returned
      console.error('Error finding user:', findError);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=database_error`);
    }
    
    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          github_id: userData.id.toString(),
          github_username: userData.login,
          github_access_token: accessToken,
          name: userData.name || existingUser.name,
          avatar_url: userData.avatar_url || existingUser.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id);
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=database_error`);
      }
      
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: primaryEmail,
          github_id: userData.id.toString(),
          github_username: userData.login,
          github_access_token: accessToken,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=database_error`);
      }
      
      userId = newUser.id;
    }
    
    // Create Firebase custom token
    const customToken = await admin.auth().createCustomToken(userId);
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${customToken}`);
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

/**
 * Login user with Firebase token
 */
exports.login = async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
  res.status(200).json({ message: 'Logged out successfully' });
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
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Authentication failed' });
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
    await admin.auth().verifyIdToken(token);
    
    res.status(200).json({ valid: true });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
};
