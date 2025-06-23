const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Create a new deployment
 */
exports.createDeployment = async (req, res) => {
  try {
    const { projectId, branch, commitSha } = req.body;
    const userId = req.user.id;

    // Check if project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    // Create deployment record
    const deploymentId = uuidv4();
    const deploymentPath = path.join(process.env.DEPLOYMENT_DIR, deploymentId);

    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .insert({
        id: deploymentId,
        project_id: projectId,
        user_id: userId,
        branch,
        commit_sha: commitSha,
        status: 'queued',
        deployment_url: `${projectId}.${process.env.DEPLOYMENT_DOMAIN || 'launchpad.local'}`,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (deploymentError) {
      console.error('Error creating deployment:', deploymentError);
      return res.status(500).json({ error: 'Failed to create deployment' });
    }

    // Queue deployment job (in a real system, this would be handled by a job queue)
    setTimeout(() => {
      processDeployment(deployment);
    }, 0);

    res.status(201).json({ deployment });
  } catch (error) {
    console.error('Create deployment error:', error);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
};

/**
 * Get all deployments
 */
exports.getAllDeployments = async (req, res) => {
  try {
    const { data: deployments, error } = await supabase
      .from('deployments')
      .select('*, projects(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deployments:', error);
      return res.status(500).json({ error: 'Failed to fetch deployments' });
    }

    res.status(200).json({ deployments });
  } catch (error) {
    console.error('Get all deployments error:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
};

/**
 * Get deployments for current user
 */
exports.getUserDeployments = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: deployments, error } = await supabase
      .from('deployments')
      .select('*, projects(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user deployments:', error);
      return res.status(500).json({ error: 'Failed to fetch deployments' });
    }

    res.status(200).json({ deployments });
  } catch (error) {
    console.error('Get user deployments error:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
};

/**
 * Get deployment by ID
 */
exports.getDeploymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('*, projects(name, framework)')
      .eq('id', id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Check if user has access to this deployment
    if (deployment.user_id !== userId) {
      const { data: project } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', deployment.project_id)
        .eq('user_id', userId)
        .single();

      if (!project) {
        return res.status(403).json({ error: 'Unauthorized access to deployment' });
      }
    }

    res.status(200).json({ deployment });
  } catch (error) {
    console.error('Get deployment by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch deployment' });
  }
};

/**
 * Update deployment
 */
exports.updateDeployment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, deploymentUrl } = req.body;
    const userId = req.user.id;

    // Check if deployment exists and belongs to user
    const { data: existingDeployment, error: findError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingDeployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (existingDeployment.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this deployment' });
    }

    // Update deployment
    const { data: deployment, error: updateError } = await supabase
      .from('deployments')
      .update({
        status: status || existingDeployment.status,
        deployment_url: deploymentUrl || existingDeployment.deployment_url,
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating deployment:', updateError);
      return res.status(500).json({ error: 'Failed to update deployment' });
    }

    res.status(200).json({ deployment });
  } catch (error) {
    console.error('Update deployment error:', error);
    res.status(500).json({ error: 'Failed to update deployment' });
  }
};

/**
 * Delete deployment
 */
exports.deleteDeployment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if deployment exists and belongs to user
    const { data: existingDeployment, error: findError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingDeployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (existingDeployment.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this deployment' });
    }

    // Delete deployment files
    const deploymentPath = path.join(process.env.DEPLOYMENT_DIR, id);
    if (fs.existsSync(deploymentPath)) {
      fs.rmSync(deploymentPath, { recursive: true, force: true });
    }

    // Delete deployment record
    const { error: deleteError } = await supabase
      .from('deployments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting deployment:', deleteError);
      return res.status(500).json({ error: 'Failed to delete deployment' });
    }

    res.status(200).json({ message: 'Deployment deleted successfully' });
  } catch (error) {
    console.error('Delete deployment error:', error);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
};

/**
 * Rebuild deployment
 */
exports.rebuildDeployment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if deployment exists and belongs to user
    const { data: existingDeployment, error: findError } = await supabase
      .from('deployments')
      .select('*, projects(framework)')
      .eq('id', id)
      .single();

    if (findError || !existingDeployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (existingDeployment.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to rebuild this deployment' });
    }

    // Update deployment status
    await supabase
      .from('deployments')
      .update({
        status: 'queued',
        updated_at: new Date()
      })
      .eq('id', id);

    // Queue rebuild job
    setTimeout(() => {
      processDeployment(existingDeployment);
    }, 0);

    res.status(200).json({ message: 'Deployment rebuild initiated' });
  } catch (error) {
    console.error('Rebuild deployment error:', error);
    res.status(500).json({ error: 'Failed to rebuild deployment' });
  }
};

/**
 * Get deployment logs
 */
exports.getDeploymentLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if deployment exists and belongs to user
    const { data: existingDeployment, error: findError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingDeployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (existingDeployment.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view this deployment logs' });
    }

    // Get deployment logs
    const { data: logs, error: logsError } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('deployment_id', id)
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('Error fetching deployment logs:', logsError);
      return res.status(500).json({ error: 'Failed to fetch deployment logs' });
    }

    res.status(200).json({ logs });
  } catch (error) {
    console.error('Get deployment logs error:', error);
    res.status(500).json({ error: 'Failed to fetch deployment logs' });
  }
};

/**
 * Get deployment status
 */
exports.getDeploymentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('status, deployment_url, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.status(200).json({ status: deployment.status, url: deployment.deployment_url });
  } catch (error) {
    console.error('Get deployment status error:', error);
    res.status(500).json({ error: 'Failed to fetch deployment status' });
  }
};

/**
 * Process deployment (internal function)
 */
async function processDeployment(deployment) {
  try {
    // Update status to processing
    await supabase
      .from('deployments')
      .update({
        status: 'processing',
        updated_at: new Date()
      })
      .eq('id', deployment.id);

    // Log deployment start
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        message: 'Deployment started',
        level: 'info',
        created_at: new Date()
      });

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', deployment.project_id)
      .single();

    // Create deployment directory
    const deploymentPath = path.join(process.env.DEPLOYMENT_DIR, deployment.id);
    if (!fs.existsSync(deploymentPath)) {
      fs.mkdirSync(deploymentPath, { recursive: true });
    }

    // Clone repository
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        message: `Cloning repository: ${project.repository_url}`,
        level: 'info',
        created_at: new Date()
      });

    try {
      await execPromise(`git clone ${project.repository_url} ${deploymentPath}`);
      
      if (deployment.branch !== 'main' && deployment.branch !== 'master') {
        await execPromise(`cd ${deploymentPath} && git checkout ${deployment.branch}`);
      }
      
      if (deployment.commit_sha) {
        await execPromise(`cd ${deploymentPath} && git checkout ${deployment.commit_sha}`);
      }
    } catch (error) {
      await handleDeploymentError(deployment.id, `Git clone error: ${error.message}`);
      return;
    }

    // Install dependencies
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        message: 'Installing dependencies',
        level: 'info',
        created_at: new Date()
      });

    try {
      await execPromise(`cd ${deploymentPath} && npm install`);
    } catch (error) {
      await handleDeploymentError(deployment.id, `Dependency installation error: ${error.message}`);
      return;
    }

    // Build project
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        message: 'Building project',
        level: 'info',
        created_at: new Date()
      });

    try {
      await execPromise(`cd ${deploymentPath} && npm run build`);
    } catch (error) {
      await handleDeploymentError(deployment.id, `Build error: ${error.message}`);
      return;
    }

    // Deploy to hosting
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        message: 'Deploying to hosting',
        level: 'info',
        created_at: new Date()
      });

    // Update deployment status to success
    await supabase
      .from('deployments')
      .update({
        status: 'success',
        updated_at: new Date()
      })
      .eq('id', deployment.id);

    // Log deployment success
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        message: `Deployment successful. Available at: ${deployment.deployment_url}`,
        level: 'info',
        created_at: new Date()
      });
  } catch (error) {
    await handleDeploymentError(deployment.id, `Deployment error: ${error.message}`);
  }
}

/**
 * Handle deployment error (internal function)
 */
async function handleDeploymentError(deploymentId, errorMessage) {
  // Update deployment status to failed
  await supabase
    .from('deployments')
    .update({
      status: 'failed',
      updated_at: new Date()
    })
    .eq('id', deploymentId);

  // Log deployment error
  await supabase
    .from('deployment_logs')
    .insert({
      deployment_id: deploymentId,
      message: errorMessage,
      level: 'error',
      created_at: new Date()
    });
}
