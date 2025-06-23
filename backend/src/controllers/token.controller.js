const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Set GitHub access token for a user
 */
exports.setGithubToken = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.firebase_uid || req.user.id;
    const { token, code } = req.body;
    
    let githubToken = token;
    
    // If code is provided instead of token, exchange it for a token
    if (code && !token) {
      try {
        console.log('Exchanging GitHub code for token');
        const axios = require('axios');
        
        // Exchange code for access token
        const tokenResponse = await axios({
          method: 'post',
          url: 'https://github.com/login/oauth/access_token',
          params: {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code
          },
          headers: {
            accept: 'application/json'
          }
        });
        
        githubToken = tokenResponse.data.access_token;
        
        if (!githubToken) {
          console.error('Failed to get GitHub access token', tokenResponse.data);
          return res.status(400).json({ error: 'Failed to exchange code for GitHub token' });
        }
        
        console.log('GitHub access token obtained successfully');
      } catch (exchangeError) {
        console.error('Error exchanging code for token:', exchangeError.message);
        return res.status(400).json({ error: 'Failed to exchange code for GitHub token' });
      }
    } else if (!githubToken) {
      return res.status(400).json({ error: 'GitHub token or code is required' });
    }
    
    console.log('Setting GitHub access token for user:', userId);
    
    // First check if the github_access_token column exists
    try {
      // Try to add the column if it doesn't exist
      await supabase.rpc('add_github_token_column').catch(error => {
        console.log('Error calling RPC function (expected if function does not exist):', error.message);
        // Fallback to direct SQL (will only work if RLS is disabled)
        return supabase.from('_exec_sql').select('*').eq('query', `
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
      });
    } catch (error) {
      console.log('Error ensuring column exists:', error.message);
      // Continue anyway, the column might already exist
    }
    
    // Update the user with the GitHub token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', userId)
      .single();
    
    if (userError) {
      console.error('Error finding user:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the user with the token
    const { error: updateError } = await supabase
      .from('users')
      .update({ github_access_token: githubToken })
      .eq('firebase_uid', userId);
    
    if (updateError) {
      console.error('Error updating token with standard method:', updateError);
      
      // Try fallback method 1: Use RPC function
      try {
        console.log('Trying fallback method 1: RPC function');
        const { data: rpcData, error: rpcError } = await supabase.rpc('update_github_token', {
          user_firebase_uid: userId,
          token: githubToken
        });
        
        if (rpcError) {
          console.error('Error updating token with RPC function:', rpcError);
          
          // Try fallback method 2: Direct SQL
          try {
            console.log('Trying fallback method 2: Direct SQL');
            const { data: sqlData, error: sqlError } = await supabase.from('_exec_sql').select('*').eq('query', `
              UPDATE public.users 
              SET github_access_token = '${githubToken.replace(/'/g, "''")}' 
              WHERE firebase_uid = '${userId.replace(/'/g, "''")}'
            `).single();
            
            if (sqlError) {
              console.error('Error updating token with direct SQL:', sqlError);
              return res.status(500).json({ error: 'Failed to update token after multiple attempts' });
            }
            
            console.log('Token updated successfully with direct SQL');
          } catch (sqlCatchError) {
            console.error('Exception during direct SQL update:', sqlCatchError);
            return res.status(500).json({ error: 'Failed to update token after multiple attempts' });
          }
        } else {
          console.log('Token updated successfully with RPC function');
        }
      } catch (rpcCatchError) {
        console.error('Exception during RPC function call:', rpcCatchError);
        return res.status(500).json({ error: 'Failed to update token after multiple attempts' });
      }
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
    
    console.log('GitHub token set successfully for user:', userId);
    return res.status(200).json({ message: 'GitHub token set successfully' });
  } catch (error) {
    console.error('Error setting GitHub token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get GitHub access token status for a user
 */
exports.getTokenStatus = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.firebase_uid || req.user.id;
    
    console.log('Checking GitHub token status for user:', userId);
    
    // Get the user from the database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('github_access_token, github_username')
      .eq('firebase_uid', userId)
      .single();
    
    if (userError) {
      console.error('Error finding user:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json({
      hasToken: !!user.github_access_token,
      github_username: user.github_username || null
    });
  } catch (error) {
    console.error('Error checking token status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
