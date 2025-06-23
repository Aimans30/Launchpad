const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Debug endpoint to check if github_access_token is being stored correctly
 */
exports.checkGithubToken = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.firebase_uid || req.user.id;
    
    console.log('Debug controller - Checking GitHub token for user:', userId);
    
    // First, check the users table structure to confirm github_access_token column exists
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'users' });
      
    if (columnsError) {
      console.error('Error checking table structure:', columnsError);
      return res.status(500).json({ error: 'Failed to check table structure', details: columnsError });
    }
    
    console.log('Users table columns:', columns);
    
    // Get user from database to check GitHub access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', userId)
      .single();
      
    if (userError) {
      console.error('Error fetching user:', userError);
      return res.status(404).json({ error: 'User not found', details: userError });
    }
    
    // For security, don't return the actual token in the response
    const userInfo = {
      ...user,
      github_access_token: user.github_access_token ? 'TOKEN_PRESENT' : 'NO_TOKEN'
    };
    
    console.log('User data from database:', userInfo);
    
    // Try to manually update the token for testing
    if (!user.github_access_token) {
      console.log('Attempting to manually set a test token...');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ github_access_token: 'test_token_value' })
        .eq('firebase_uid', userId);
        
      if (updateError) {
        console.error('Error updating token:', updateError);
        return res.status(500).json({ 
          error: 'Failed to update token', 
          details: updateError,
          userInfo 
        });
      }
      
      console.log('Test token set successfully');
      userInfo.github_access_token = 'TEST_TOKEN_SET';
    }
    
    return res.status(200).json({
      message: 'GitHub token check complete',
      userInfo,
      columnsExist: columns.some(col => col.column_name === 'github_access_token')
    });
  } catch (error) {
    console.error('Debug controller error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Debug endpoint to manually set a GitHub access token
 */
exports.setGithubToken = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.firebase_uid || req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    console.log('Debug controller - Setting GitHub token for user:', userId);
    
    // Update the user with the provided token
    const { error: updateError } = await supabase
      .from('users')
      .update({ github_access_token: token })
      .eq('firebase_uid', userId);
      
    if (updateError) {
      console.error('Error setting token:', updateError);
      return res.status(500).json({ error: 'Failed to set token', details: updateError });
    }
    
    return res.status(200).json({ message: 'GitHub token set successfully' });
  } catch (error) {
    console.error('Debug controller error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
