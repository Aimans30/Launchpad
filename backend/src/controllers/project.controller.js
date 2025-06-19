const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Create a new project
 */
exports.createProject = async (req, res) => {
  try {
    const { name, repositoryUrl, framework, subdomain, environmentVariables } = req.body;
    const userId = req.user.id;

    // Check if subdomain is available
    const { data: existingSubdomain } = await supabase
      .from('projects')
      .select('id')
      .eq('subdomain', subdomain)
      .single();

    if (existingSubdomain) {
      return res.status(400).json({ error: 'Subdomain already in use' });
    }

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        id: uuidv4(),
        name,
        repository_url: repositoryUrl,
        framework,
        subdomain,
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({ error: 'Failed to create project' });
    }

    // Add environment variables if provided
    if (environmentVariables && environmentVariables.length > 0) {
      const envVars = environmentVariables.map(env => ({
        id: uuidv4(),
        project_id: project.id,
        key: env.key,
        value: env.value,
        environment: env.environment || 'production',
        created_at: new Date(),
        updated_at: new Date()
      }));

      const { error: envError } = await supabase
        .from('environment_variables')
        .insert(envVars);

      if (envError) {
        console.error('Error adding environment variables:', envError);
      }
    }

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

/**
 * Get all projects
 */
exports.getAllProjects = async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.status(200).json({ projects });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

/**
 * Get projects for current user
 */
exports.getUserProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.status(200).json({ projects });
  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

/**
 * Get project by ID
 */
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user has access to this project
    if (project.user_id !== userId) {
      const { data: projectMember } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', userId)
        .single();

      if (!projectMember) {
        return res.status(403).json({ error: 'Unauthorized access to project' });
      }
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

/**
 * Update project
 */
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, repositoryUrl, framework, subdomain } = req.body;
    const userId = req.user.id;

    // Check if project exists and belongs to user
    const { data: existingProject, error: findError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (existingProject.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this project' });
    }

    // Check if new subdomain is available (if changed)
    if (subdomain && subdomain !== existingProject.subdomain) {
      const { data: existingSubdomain } = await supabase
        .from('projects')
        .select('id')
        .eq('subdomain', subdomain)
        .neq('id', id)
        .single();

      if (existingSubdomain) {
        return res.status(400).json({ error: 'Subdomain already in use' });
      }
    }

    // Update project
    const { data: project, error: updateError } = await supabase
      .from('projects')
      .update({
        name: name || existingProject.name,
        repository_url: repositoryUrl || existingProject.repository_url,
        framework: framework || existingProject.framework,
        subdomain: subdomain || existingProject.subdomain,
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return res.status(500).json({ error: 'Failed to update project' });
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

/**
 * Delete project
 */
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if project exists and belongs to user
    const { data: existingProject, error: findError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (existingProject.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this project' });
    }

    // Delete related records first (environment variables, deployments, etc.)
    await supabase.from('environment_variables').delete().eq('project_id', id);
    await supabase.from('project_members').delete().eq('project_id', id);
    
    // Get deployments for this project
    const { data: deployments } = await supabase
      .from('deployments')
      .select('id')
      .eq('project_id', id);
    
    if (deployments && deployments.length > 0) {
      const deploymentIds = deployments.map(d => d.id);
      await supabase.from('deployment_logs').delete().in('deployment_id', deploymentIds);
      await supabase.from('deployments').delete().eq('project_id', id);
    }

    // Delete project
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting project:', deleteError);
      return res.status(500).json({ error: 'Failed to delete project' });
    }

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

/**
 * Get project deployments
 */
exports.getProjectDeployments = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId) {
      const { data: projectMember } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', userId)
        .single();

      if (!projectMember) {
        return res.status(403).json({ error: 'Unauthorized access to project' });
      }
    }

    // Get deployments
    const { data: deployments, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching project deployments:', error);
      return res.status(500).json({ error: 'Failed to fetch deployments' });
    }

    res.status(200).json({ deployments });
  } catch (error) {
    console.error('Get project deployments error:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
};

/**
 * Create environment variable
 */
exports.createEnvironment = async (req, res) => {
  try {
    const { id } = req.params;
    const { key, value, environment } = req.body;
    const userId = req.user.id;

    // Check if project exists and belongs to user
    const { data: existingProject, error: findError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (existingProject.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this project' });
    }

    // Create environment variable
    const { data: envVar, error } = await supabase
      .from('environment_variables')
      .insert({
        id: uuidv4(),
        project_id: id,
        key,
        value,
        environment: environment || 'production',
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating environment variable:', error);
      return res.status(500).json({ error: 'Failed to create environment variable' });
    }

    res.status(201).json({ environmentVariable: envVar });
  } catch (error) {
    console.error('Create environment variable error:', error);
    res.status(500).json({ error: 'Failed to create environment variable' });
  }
};

/**
 * Get environment variables for a project
 */
exports.getEnvironments = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId) {
      const { data: projectMember } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', userId)
        .single();

      if (!projectMember) {
        return res.status(403).json({ error: 'Unauthorized access to project' });
      }
    }

    // Get environment variables
    const { data: envVars, error } = await supabase
      .from('environment_variables')
      .select('*')
      .eq('project_id', id)
      .order('key', { ascending: true });

    if (error) {
      console.error('Error fetching environment variables:', error);
      return res.status(500).json({ error: 'Failed to fetch environment variables' });
    }

    res.status(200).json({ environmentVariables: envVars });
  } catch (error) {
    console.error('Get environment variables error:', error);
    res.status(500).json({ error: 'Failed to fetch environment variables' });
  }
};
