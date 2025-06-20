const { createClient } = require('@supabase/supabase-js');

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
    const userId = req.user.id;

    // Get user from database to retrieve GitHub access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('github_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.github_access_token) {
      return res.status(401).json({ error: 'GitHub authentication required' });
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
      return res.status(response.status).json({ error: 'Failed to fetch repositories from GitHub' });
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
    const userId = req.user.id;
    const { owner, repo } = req.params;

    // Get user from database to retrieve GitHub access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('github_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.github_access_token) {
      return res.status(401).json({ error: 'GitHub authentication required' });
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
      return res.status(response.status).json({ error: 'Failed to fetch branches from GitHub' });
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
    const userId = req.user.id;
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
      .eq('id', userId)
      .single();

    if (userError || !user || !user.github_access_token) {
      return res.status(401).json({ error: 'GitHub authentication required' });
    }

    // Check repository access
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `token ${user.github_access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return res.status(403).json({ error: 'Repository not found or no access' });
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
