const admin = require('firebase-admin');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Store state parameters to prevent CSRF attacks
const stateStore = new Map();

/**
 * Initiate GitHub OAuth flow
 * This endpoint redirects to GitHub's authorization page
 */
exports.initiateGitHubAuth = async (req, res) => {
  try {
    // Generate a random state parameter to prevent CSRF attacks
    const state = crypto.randomBytes(20).toString('hex');
    
    // Store the state with an expiration time (10 minutes)
    stateStore.set(state, {
      timestamp: Date.now(),
      redirectUrl: req.query.redirect_url || '/dashboard'
    });
    
    // Clean up expired states (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of stateStore.entries()) {
      if (value.timestamp < tenMinutesAgo) {
        stateStore.delete(key);
      }
    }
    
    // GitHub OAuth parameters
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.BACKEND_URL}/api/auth/github/callback`;
    const scope = 'user:email,repo';
    
    // Construct the GitHub authorization URL
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    
    // Redirect to GitHub authorization page
    res.redirect(githubAuthUrl);
  } catch (error) {
    console.error('GitHub auth initiation error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_initiation_failed`);
  }
};

/**
 * Handle GitHub OAuth callback
 * This endpoint exchanges the code for an access token and creates a Firebase custom token
 */
exports.handleGitHubCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Validate state parameter to prevent CSRF attacks
    if (!state || !stateStore.has(state)) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
    }
    
    // Get stored state data and remove it from the store
    const stateData = stateStore.get(state);
    stateStore.delete(state);
    
    // Exchange code for GitHub access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/github/callback`
    }, {
      headers: {
        Accept: 'application/json'
      }
    });
    
    const { access_token: githubAccessToken } = tokenResponse.data;
    
    if (!githubAccessToken) {
      console.error('Failed to get GitHub access token', tokenResponse.data);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_token_failed`);
    }
    
    // Get GitHub user data
    const githubUserResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${githubAccessToken}`
      }
    });
    
    const githubUser = githubUserResponse.data;
    
    // Get GitHub email (might be private)
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${githubAccessToken}`
      }
    });
    
    // Find primary email
    const primaryEmail = emailsResponse.data.find(email => email.primary)?.email || emailsResponse.data[0]?.email;
    
    if (!primaryEmail) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email_found`);
    }
    
    // Check if user exists in Firebase by email
    try {
      const userRecord = await admin.auth().getUserByEmail(primaryEmail);
      
      // User exists, update their GitHub data
      await updateUserData(userRecord.uid, {
        github_id: githubUser.id.toString(),
        github_username: githubUser.login,
        github_access_token: githubAccessToken,
        name: githubUser.name || githubUser.login,
        avatar_url: githubUser.avatar_url
      });
      
      // Create a custom token for the user
      const customToken = await admin.auth().createCustomToken(userRecord.uid);
      
      // Redirect to frontend with the token
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${customToken}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist, create a new one
        const newUser = await admin.auth().createUser({
          email: primaryEmail,
          displayName: githubUser.name || githubUser.login,
          photoURL: githubUser.avatar_url
        });
        
        // Store additional user data
        await updateUserData(newUser.uid, {
          github_id: githubUser.id.toString(),
          github_username: githubUser.login,
          github_access_token: githubAccessToken,
          name: githubUser.name || githubUser.login,
          avatar_url: githubUser.avatar_url,
          email: primaryEmail
        });
        
        // Create a custom token for the new user
        const customToken = await admin.auth().createCustomToken(newUser.uid);
        
        // Redirect to frontend with the token
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${customToken}`);
      } else {
        console.error('Firebase auth error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=firebase_auth_error`);
      }
    }
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=github_callback_failed`);
  }
};

/**
 * Update user data in Supabase
 */
async function updateUserData(userId, userData) {
  try {
    // Check if user exists in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (existingUser) {
      // Update existing user
      await supabase
        .from('users')
        .update(userData)
        .eq('id', userId);
    } else {
      // Insert new user
      await supabase
        .from('users')
        .insert([{
          id: userId,
          ...userData
        }]);
    }
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
}
