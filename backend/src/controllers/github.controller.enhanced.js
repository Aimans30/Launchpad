const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Get repositories for the authenticated user
 */
exports.getRepositories = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.firebase_uid || req.user.id;
    console.log('GitHub controller - Getting repositories for user ID:', userId);

    // Try multiple ways to find the user and their GitHub token
    let user = null;
    let tokenFound = false;
    
    // First try by firebase_uid
    const { data: userByFirebaseUid, error: firebaseUidError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', userId)
      .single();
      
    if (userByFirebaseUid?.github_access_token) {
      console.log('Found token using firebase_uid');
      user = userByFirebaseUid;
      tokenFound = true;
    } else {
      console.log('Token not found using firebase_uid, trying id field');
      
      // Try by id field as fallback
      const { data: userById, error: idError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (userById?.github_access_token) {
        console.log('Found token using id field');
        user = userById;
        tokenFound = true;
      }
    }
    
    // Log detailed debug info
    console.log('GitHub controller - User lookup results:', { 
      userId, 
      foundByFirebaseUid: !!userByFirebaseUid, 
      foundById: !!user && !userByFirebaseUid,
      tokenFound: tokenFound
    });
    
    if (!tokenFound) {
      // Log all users in the database to help debug
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, firebase_uid, github_username')
        .limit(10);
        
      console.log('Available users in database:', allUsers);
      
      return res.status(401).json({ 
        error: 'GitHub authentication required', 
        message: 'No GitHub access token found for your account. Please reconnect your GitHub account.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    // Verify the token is still valid
    try {
      const verifyResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${user.github_access_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      
      if (verifyResponse.status !== 200) {
        console.log('GitHub token validation failed:', verifyResponse.status);
        return res.status(401).json({ 
          error: 'GitHub token expired', 
          message: 'Your GitHub access token has expired. Please reconnect your GitHub account.',
          reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
        });
      }
      
      console.log('GitHub token validated successfully');
    } catch (tokenError) {
      console.error('Error validating GitHub token:', tokenError.message);
      return res.status(401).json({ 
        error: 'GitHub token invalid', 
        message: 'Your GitHub access token is invalid. Please reconnect your GitHub account.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    // Fetch repositories from GitHub API
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `token ${user.github_access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('GitHub API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to fetch repositories from GitHub',
        message: 'There was an error fetching your GitHub repositories. Please try again or reconnect your GitHub account.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    const repositories = await response.json();
    
    // Return only the data we need
    const formattedRepos = repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      default_branch: repo.default_branch,
      visibility: repo.visibility,
      updated_at: repo.updated_at,
    }));

    res.status(200).json({ repositories: formattedRepos });
  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
};

/**
 * Get branches for a specific repository
 */
exports.getRepositoryBranches = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.firebase_uid || req.user.id;
    const { owner, repo } = req.params;

    // Try multiple ways to find the user and their GitHub token
    let user = null;
    let tokenFound = false;
    
    // First try by firebase_uid
    const { data: userByFirebaseUid, error: firebaseUidError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', userId)
      .single();
      
    if (userByFirebaseUid?.github_access_token) {
      console.log('Found token using firebase_uid');
      user = userByFirebaseUid;
      tokenFound = true;
    } else {
      console.log('Token not found using firebase_uid, trying id field');
      
      // Try by id field as fallback
      const { data: userById, error: idError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (userById?.github_access_token) {
        console.log('Found token using id field');
        user = userById;
        tokenFound = true;
      }
    }
    
    // Log detailed debug info
    console.log('GitHub controller (branches) - User lookup results:', { 
      userId, 
      foundByFirebaseUid: !!userByFirebaseUid, 
      foundById: !!user && !userByFirebaseUid,
      tokenFound: tokenFound
    });
    
    if (!tokenFound) {
      // Log all users in the database to help debug
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, firebase_uid, github_username')
        .limit(10);
        
      console.log('Available users in database:', allUsers);
      
      return res.status(401).json({ 
        error: 'GitHub authentication required', 
        message: 'No GitHub access token found for your account. Please reconnect your GitHub account.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    // Fetch branches from GitHub API
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        Authorization: `token ${user.github_access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('GitHub API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to fetch branches from GitHub',
        message: 'There was an error fetching repository branches. Please try again or reconnect your GitHub account.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    const branches = await response.json();
    
    res.status(200).json({ branches });
  } catch (error) {
    console.error('Get repository branches error:', error);
    res.status(500).json({ error: 'Failed to fetch repository branches' });
  }
};

/**
 * Validate repository access
 */
exports.validateRepository = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { repositoryUrl } = req.body;

    // Extract owner and repo from URL
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repositoryUrl.match(urlPattern);
    
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }
    
    const [, owner, repo] = match;

    // Get user from database to retrieve GitHub access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('github_access_token')
      .eq('firebase_uid', userId)
      .single();
      
    console.log('GitHub controller (validate) - User lookup result:', { userId, userFound: !!user, hasToken: user?.github_access_token ? true : false });

    if (userError || !user || !user.github_access_token) {
      return res.status(401).json({ 
        error: 'GitHub authentication required',
        message: 'No GitHub access token found for your account. Please reconnect your GitHub account.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    // Check repository access
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `token ${user.github_access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return res.status(403).json({ 
        error: 'Repository not found or no access',
        message: 'The repository was not found or you do not have access to it. Please check the URL and your GitHub permissions.',
        reconnectUrl: `${process.env.FRONTEND_URL}/projects?reconnect=github`
      });
    }

    const repoData = await response.json();
    
    res.status(200).json({ 
      valid: true, 
      repository: {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        default_branch: repoData.default_branch,
        visibility: repoData.visibility
      } 
    });
  } catch (error) {
    console.error('Validate repository error:', error);
    res.status(500).json({ error: 'Failed to validate repository' });
  }
};
