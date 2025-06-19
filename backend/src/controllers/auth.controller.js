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
  const redirectUrl = `${process.env.FRONTEND_URL}/auth/github/callback`;
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
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;
    
    // Get user data from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });
    
    const userData = await userResponse.json();
    
    // Get user emails
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });
    
    const emails = await emailsResponse.json();
    const primaryEmail = emails.find(email => email.primary)?.email || emails[0]?.email;
    
    if (!primaryEmail) {
      return res.status(400).json({ error: 'No email found in GitHub account' });
    }
    
    // Check if user exists in Supabase
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', primaryEmail)
      .single();
    
    let userId;
    
    if (findError || !existingUser) {
      // Create new user in Supabase
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: primaryEmail,
          github_id: userData.id.toString(),
          github_username: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
          github_access_token: access_token,
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }
      
      userId = newUser.id;
    } else {
      // Update existing user
      userId = existingUser.id;
      
      await supabase
        .from('users')
        .update({
          github_username: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
          github_access_token: access_token,
          updated_at: new Date(),
        })
        .eq('id', userId);
    }
    
    // Create custom token for Firebase Auth
    const customToken = await admin.auth().createCustomToken(userId.toString());
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${customToken}`);
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
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
