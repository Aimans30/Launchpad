const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Store GitHub access token for a user
 * This is a direct approach to store the token in the database
 */
exports.storeGithubToken = async (req, res) => {
  try {
    // Verify Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // Get code and state from query params
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }
    
    console.log('Exchanging code for GitHub access token...');
    
    // Exchange code for GitHub access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, {
      headers: {
        Accept: 'application/json'
      }
    });
    
    const { access_token: githubAccessToken } = tokenResponse.data;
    
    if (!githubAccessToken) {
      console.error('Failed to get GitHub access token', tokenResponse.data);
      return res.status(500).json({ error: 'Failed to get GitHub access token' });
    }
    
    console.log('GitHub access token obtained successfully:', githubAccessToken.substring(0, 5) + '...');
    
    // Store the token in the database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', userId)
      .single();
      
    if (userError) {
      console.error('Error finding user:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the user with the GitHub access token
    const { error: updateError } = await supabase
      .from('users')
      .update({ github_access_token: githubAccessToken })
      .eq('firebase_uid', userId);
      
    if (updateError) {
      console.error('Error updating GitHub token:', updateError);
      return res.status(500).json({ error: 'Failed to update GitHub token' });
    }
    
    // Verify the token was stored
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('github_access_token')
      .eq('firebase_uid', userId)
      .single();
      
    if (verifyError || !verifyUser.github_access_token) {
      console.error('Token verification failed:', verifyError || 'Token not stored');
      return res.status(500).json({ error: 'Token verification failed' });
    }
    
    console.log('GitHub token stored successfully for user:', userId);
    
    // Return success
    return res.status(200).json({ 
      message: 'GitHub token stored successfully',
      tokenStored: true
    });
  } catch (error) {
    console.error('Error storing GitHub token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
