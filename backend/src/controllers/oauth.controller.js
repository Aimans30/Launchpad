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
    
    console.log('GitHub access token obtained successfully:', githubAccessToken.substring(0, 5) + '...');
    
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
      
      // Directly update the GitHub access token in the database as a failsafe
      try {
        const { error: directUpdateError } = await supabase
          .from('users')
          .update({ github_access_token: githubAccessToken })
          .eq('firebase_uid', userRecord.uid);
          
        if (directUpdateError) {
          console.error('Error in direct token update:', directUpdateError);
          
          // Try with raw SQL as a last resort
          try {
            const { data, error } = await supabase.rpc('update_github_token', {
              p_firebase_uid: userRecord.uid,
              p_github_token: githubAccessToken
            });
            
            if (error) {
              console.error('Error in RPC token update:', error);
            } else {
              console.log('RPC token update successful');
            }
          } catch (rpcError) {
            console.error('Exception in RPC token update:', rpcError);
            
            // Final attempt with direct SQL
            try {
              const { data, error } = await supabase.rpc('execute_sql', {
                sql: `UPDATE users SET github_access_token = '${githubAccessToken}' WHERE firebase_uid = '${userRecord.uid}'`
              });
              
              if (error) {
                console.error('Error in SQL token update:', error);
              } else {
                console.log('SQL token update successful');
              }
            } catch (sqlError) {
              console.error('Exception in SQL token update:', sqlError);
            }
          }
        } else {
          console.log('Direct token update successful');
        }
      } catch (tokenUpdateError) {
        console.error('Exception in direct token update:', tokenUpdateError);
      }
      
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
        
        // Directly update the GitHub access token in the database as a failsafe
        try {
          const { error: directUpdateError } = await supabase
            .from('users')
            .update({ github_access_token: githubAccessToken })
            .eq('firebase_uid', newUser.uid);
            
          if (directUpdateError) {
            console.error('Error in direct token update for new user:', directUpdateError);
          } else {
            console.log('Direct token update successful for new user');
          }
        } catch (tokenUpdateError) {
          console.error('Exception in direct token update for new user:', tokenUpdateError);
        }
        
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
 * Ensure the github_access_token column exists in the users table
 */
async function ensureGithubTokenColumn() {
  try {
    console.log('Checking if github_access_token column exists...');
    
    // Execute SQL to add the column if it doesn't exist
    const { error } = await supabase.rpc('add_github_token_column');
    
    if (error) {
      console.error('Error ensuring github_access_token column:', error);
      
      // Try direct SQL approach
      const { error: sqlError } = await supabase.from('_exec_sql').select('*').eq('query', `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'github_access_token'
          ) THEN
            ALTER TABLE public.users ADD COLUMN github_access_token TEXT;
          END IF;
        END $$;
      `).single();
      
      if (sqlError) {
        console.error('Error executing direct SQL:', sqlError);
      } else {
        console.log('Direct SQL executed successfully');
      }
    } else {
      console.log('Column check completed successfully');
    }
  } catch (error) {
    console.error('Error in ensureGithubTokenColumn:', error);
  }
}

/**
 * Update user data in Supabase
 */
async function updateUserData(userId, userData) {
  try {
    // First ensure the github_access_token column exists
    await ensureGithubTokenColumn();
    
    console.log('Updating user data for user ID:', userId);
    
    // Ensure the GitHub access token is included in the userData
    if (userData.github_access_token) {
      console.log('GitHub access token is present in userData:', userData.github_access_token.substring(0, 5) + '...');
    } else {
      console.log('WARNING: No GitHub access token provided in userData');
    }
    
    console.log('User data to update:', { 
      ...userData, 
      github_access_token: userData.github_access_token ? 'TOKEN_PRESENT' : 'NO_TOKEN' 
    });
    
    // Check if user exists in Supabase by firebase_uid
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', userId)
      .single();
      
    console.log('User lookup result:', { found: !!existingUser, error: lookupError?.message });
    
    if (existingUser) {
      console.log('Updating existing user with ID:', existingUser.id);
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update(userData)
        .eq('firebase_uid', userId);
        
      if (updateError) {
        console.error('Error updating user:', updateError);
        
        // Try alternative update using id instead of firebase_uid
        console.log('Trying alternative update with ID:', existingUser.id);
        const { error: altUpdateError } = await supabase
          .from('users')
          .update(userData)
          .eq('id', existingUser.id);
          
        if (altUpdateError) {
          console.error('Alternative update also failed:', altUpdateError);
        } else {
          console.log('Alternative update succeeded');
        }
      } else {
        console.log('User updated successfully');
      }
      
      // Verify the token was stored
      const { data: verifyUser } = await supabase
        .from('users')
        .select('github_access_token')
        .eq('firebase_uid', userId)
        .single();
        
      console.log('Token verification:', {
        tokenStored: verifyUser?.github_access_token ? true : false
      });
    } else {
      console.log('Creating new user with firebase_uid:', userId);
      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          firebase_uid: userId,
          ...userData
        }]);
        
      if (insertError) {
        console.error('Error inserting new user:', insertError);
      } else {
        console.log('New user created successfully');
        
        // Verify the token was stored
        const { data: verifyUser } = await supabase
          .from('users')
          .select('github_access_token')
          .eq('firebase_uid', userId)
          .single();
          
        console.log('Token verification after insert:', {
          tokenStored: verifyUser?.github_access_token ? true : false
        });
      }
    }
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
}
