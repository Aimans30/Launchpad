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

// Bucket name for site files
const BUCKET_NAME = 'sites';

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
    const userId = req.user.firebase_uid || req.user.id;
    
    console.log('Getting bucket deployments for user:', userId);
    
    // First get all sites for this user
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', userId);
    
    if (sitesError) {
      console.error('Error fetching sites:', sitesError);
      return res.status(200).json({ deployments: [] });
    }
    
    // For each site, check if it has files in storage
    const deployments = [];
    
    for (const site of sites) {
      // Get deployments for this site
      const { data: siteDeployments, error: deploymentError } = await supabase
        .from('deployments')
        .select('*')
        .eq('site_id', site.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (deploymentError) {
        console.error(`Error fetching deployments for site ${site.id}:`, deploymentError);
        continue;
      }
      
      // Check if there are files in the bucket for this site
      const { data: files, error: filesError } = await supabase.storage
        .from('public')
        .list(`sites/${site.id}`);
      
      if (filesError) {
        console.error(`Error checking storage for site ${site.id}:`, filesError);
        continue;
      }
      
      // If there are files, add the site and its deployments
      if (files && files.length > 0) {
        // Add each deployment with site info
        for (const deployment of siteDeployments || []) {
          deployments.push({
            ...deployment,
            sites: site,
            file_count: files.length
          });
        }
        
        // If no deployments but files exist, create a virtual deployment
        if ((!siteDeployments || siteDeployments.length === 0) && site.site_url) {
          deployments.push({
            id: `virtual-${site.id}`,
            site_id: site.id,
            status: 'completed',
            created_at: site.created_at,
            updated_at: site.updated_at,
            deployed_url: site.site_url,
            sites: site,
            file_count: files.length
          });
        }
      }
    }
    
    // Return the deployments
    res.status(200).json({ deployments });
    
  } catch (error) {
    console.error('Get bucket deployments error:', error);
    res.status(200).json({ deployments: [] });
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
 * Get all deployments including site deployments
 */
exports.getAllSiteDeployments = async (req, res) => {
  try {
    const userId = req.user.firebase_uid || req.user.id;

    // Get all project-based deployments
    const { data: projectDeployments, error: projectError } = await supabase
      .from('deployments')
      .select('*, projects(name)')
      .eq('user_id', userId)
      .is('site_id', null) // Only get project deployments
      .order('created_at', { ascending: false });

    if (projectError) {
      console.error('Error fetching project deployments:', projectError);
      return res.status(500).json({ error: 'Failed to fetch project deployments' });
    }

    // Get all site-based deployments
    const { data: siteDeployments, error: siteError } = await supabase
      .from('deployments')
      .select('*, sites:site_id(id, name, site_url, user_id, slug)')
      .eq('user_id', userId)
      .not('site_id', 'is', null) // Only get site deployments
      .order('created_at', { ascending: false });

    if (siteError) {
      console.error('Error fetching site deployments:', siteError);
      return res.status(500).json({ error: 'Failed to fetch site deployments' });
    }

    // Map site deployments to match the expected format
    const formattedSiteDeployments = (siteDeployments || []).map(deployment => {
      return {
        id: deployment.id,
        site_id: deployment.site_id,
        projectId: null,
        projectName: null,
        status: deployment.status || 'success',
        timestamp: deployment.deployed_at || deployment.created_at,
        type: 'site',
        projects: null,
        site: deployment.sites,
        deployed_url: deployment.deployed_url || deployment.sites?.site_url,
        deployed_at: deployment.deployed_at,
        created_at: deployment.created_at
      };
    });

    // Map project deployments to match the expected format
    const formattedProjectDeployments = (projectDeployments || []).map(deployment => {
      return {
        id: deployment.id,
        projectId: deployment.project_id,
        project_id: deployment.project_id,
        projectName: deployment.projects?.name,
        status: deployment.status,
        timestamp: deployment.created_at,
        commit: deployment.commit_sha,
        commitMessage: deployment.commit_message,
        branch: deployment.branch,
        duration: deployment.duration || 0,
        type: 'project',
        site: null,
        deployed_url: deployment.deployment_url,
        deployed_at: deployment.created_at,
        created_at: deployment.created_at,
        commit_sha: deployment.commit_sha,
        commit_message: deployment.commit_message
      };
    });

    // Combine and sort all deployments by created_at
    const allDeployments = [...formattedProjectDeployments, ...formattedSiteDeployments]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.status(200).json({ deployments: allDeployments });
  } catch (error) {
    console.error('Get all deployments error:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
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

/**
 * Get deployment files
 * Lists all files in a deployment's storage bucket
 */
exports.getDeploymentFiles = async (req, res) => {
  try {
    const { id } = req.params;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    
    // First, get the deployment to verify ownership and get site_id
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*, sites(*)')
      .eq('id', id)
      .single();
    
    if (deploymentError || !deployment) {
      // If no deployment found, try to get the site directly
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', id)
        .single();
        
      if (siteError || !site) {
        return res.status(404).json({ error: 'Deployment or site not found' });
      }
      
      // TEMPORARY: Skip user authentication check
      // if (site.user_id !== userId) {
      //   return res.status(403).json({ error: 'Unauthorized access to site' });
      // }
      
      // Use the site ID to list files
      const storagePath = `sites/${site.id}`;
      
      // List files in the storage bucket
      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(storagePath, {
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (listError) {
        console.error('Error listing files:', listError);
        return res.status(500).json({ error: 'Failed to list files' });
      }
      
      // Get the site URL
      let siteUrl = site.site_url;
      
      // If site_url is not set, try to find index.html and set the URL
      if (!siteUrl) {
        console.log('Site URL not found, searching for index.html file...');
        console.log('Available files:', files.map(f => f.name).join(', '));
        
        // Check if index.html exists in the files - with more flexible matching
        const indexFile = files?.find(file => 
          file.name === 'index.html' || 
          file.name.endsWith('/index.html') || 
          file.name.toLowerCase() === 'index.html' || 
          file.name.toLowerCase().endsWith('/index.html')
        );
        
        if (indexFile) {
          console.log(`Found index.html file: ${indexFile.name}`);
          // Generate the public URL for index.html
          const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(`${storagePath}/${indexFile.name}`);
          
          siteUrl = urlData?.publicUrl;
          console.log(`Generated URL: ${siteUrl}`);
          
          // Make sure the URL is properly formatted
          if (siteUrl && !siteUrl.startsWith('http')) {
            siteUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}/${indexFile.name}`;
            console.log(`Reformatted URL: ${siteUrl}`);
          }
          
          // Update the site record with the new URL
          if (siteUrl) {
            const { error: updateError } = await supabase
              .from('sites')
              .update({ site_url: siteUrl })
              .eq('id', site.id);
            
            if (updateError) {
              console.error('Error updating site URL:', updateError);
            } else {
              console.log(`Updated site ${site.id} with URL: ${siteUrl}`);
            }
          }
        } else {
          // Try to find any HTML file if index.html is not found
          const htmlFile = files?.find(file => 
            file.name.toLowerCase().endsWith('.html')
          );
          
          if (htmlFile) {
            console.log(`No index.html found, using alternative HTML file: ${htmlFile.name}`);
            const { data: urlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(`${storagePath}/${htmlFile.name}`);
            
            siteUrl = urlData?.publicUrl;
            console.log(`Generated URL from HTML file: ${siteUrl}`);
            
            // Update the site record with the new URL
            if (siteUrl) {
              const { error: updateError } = await supabase
                .from('sites')
                .update({ site_url: siteUrl })
                .eq('id', site.id);
              
              if (updateError) {
                console.error('Error updating site URL from HTML file:', updateError);
              } else {
                console.log(`Updated site ${site.id} with URL from HTML file: ${siteUrl}`);
              }
            }
          } else {
            // Fallback URL if no HTML file is found
            console.log('No HTML files found, using fallback URL');
            siteUrl = `${process.env.SUPABASE_URL || 'https://storage.googleapis.com'}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}/index.html`;
          }
        }
      }
      
      // Log what we're returning for debugging
      console.log('Returning site URL:', siteUrl);
      console.log('Site object:', site);
      
      // Make sure we have a valid URL before returning it
      // This is critical for the frontend to display the "View Live Site" link correctly
      if (!siteUrl || !siteUrl.startsWith('http')) {
        // Try to construct a valid URL using the SUPABASE_URL environment variable
        if (process.env.SUPABASE_URL) {
          // Look for any HTML file to use as the site URL
          const htmlFile = files?.find(file => 
            file.name.toLowerCase().endsWith('.html')
          );
          
          if (htmlFile) {
            siteUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}/${htmlFile.name}`;
            console.log(`Constructed fallback URL from HTML file: ${siteUrl}`);
            
            // Update the site record with this URL
            const { error: updateError } = await supabase
              .from('sites')
              .update({ site_url: siteUrl })
              .eq('id', site.id);
              
            if (updateError) {
              console.error('Error updating site URL with fallback:', updateError);
            } else {
              console.log(`Updated site ${site.id} with fallback URL: ${siteUrl}`);
            }
          }
        }
      }
      
      return res.status(200).json({
        files: files || [],
        path: storagePath,
        site,
        url: siteUrl
      });
    }
    
    // TEMPORARY: Skip user authentication check
    // if (deployment.user_id !== userId) {
    //   return res.status(403).json({ error: 'Unauthorized access to deployment' });
    // }
    
    // Get the site ID from the deployment
    const siteId = deployment.site_id;
    const site = deployment.sites;
    
    if (!siteId || !site) {
      return res.status(404).json({ error: 'Site not found for this deployment' });
    }
    
    // Use the site ID to list files
    const storagePath = `sites/${siteId}`;
    
    // List files in the storage bucket
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(storagePath, {
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (listError) {
      console.error('Error listing files:', listError);
      return res.status(500).json({ error: 'Failed to list files' });
    }
    
    // Get the site URL
    let siteUrl = site.site_url;
    
    // If site_url is not set, try to find index.html and set the URL
    if (!siteUrl) {
      console.log('Site URL not found, searching for index.html file...');
      console.log('Available files:', files.map(f => f.name).join(', '));
      
      // Check if index.html exists in the files - with more flexible matching
      const indexFile = files?.find(file => 
        file.name === 'index.html' || 
        file.name.endsWith('/index.html') || 
        file.name.toLowerCase() === 'index.html' || 
        file.name.toLowerCase().endsWith('/index.html')
      );
      
      if (indexFile) {
        console.log(`Found index.html file: ${indexFile.name}`);
        // Generate the public URL for index.html
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`${storagePath}/${indexFile.name}`);
        
        siteUrl = urlData?.publicUrl;
        console.log(`Generated URL: ${siteUrl}`);
        
        // Update the site record with the new URL
        if (siteUrl) {
          const { error: updateError } = await supabase
            .from('sites')
            .update({ site_url: siteUrl })
            .eq('id', site.id);
          
          if (updateError) {
            console.error('Error updating site URL:', updateError);
          } else {
            console.log(`Updated site ${site.id} with URL: ${siteUrl}`);
          }
        }
      } else {
        // Try to find any HTML file if index.html is not found
        const htmlFile = files?.find(file => 
          file.name.toLowerCase().endsWith('.html')
        );
        
        if (htmlFile) {
          console.log(`No index.html found, using alternative HTML file: ${htmlFile.name}`);
          const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(`${storagePath}/${htmlFile.name}`);
          
          siteUrl = urlData?.publicUrl;
          console.log(`Generated URL from HTML file: ${siteUrl}`);
          
          // Make sure the URL is properly formatted
          if (siteUrl && !siteUrl.startsWith('http')) {
            siteUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}/${htmlFile.name}`;
            console.log(`Reformatted URL from HTML file: ${siteUrl}`);
          }
          
          // Update the site record with the new URL
          if (siteUrl) {
            const { error: updateError } = await supabase
              .from('sites')
              .update({ site_url: siteUrl })
              .eq('id', site.id);
            
            if (updateError) {
              console.error('Error updating site URL from HTML file:', updateError);
            } else {
              console.log(`Updated site ${site.id} with URL from HTML file: ${siteUrl}`);
            }
          }
        } else {
          // Fallback URL if no HTML file is found
          console.log('No HTML files found, using fallback URL');
          siteUrl = `${process.env.SUPABASE_URL || 'https://storage.googleapis.com'}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}/index.html`;
        }
      }
    }
    
    return res.status(200).json({
      files: files || [],
      path: storagePath,
      site: site,
      url: siteUrl,
      deployment: deployment
    });
  } catch (error) {
    console.error('Error in getDeploymentFiles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get file content
 * Gets the content of a specific file in a deployment's storage bucket
 */
exports.getFileContent = async (req, res) => {
  try {
    const { id, filePath } = req.params;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    
    // First, get the deployment to verify ownership and get site_id
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*, sites(*)')
      .eq('id', id)
      .single();
    
    let siteId;
    let site;
    
    if (deploymentError || !deployment) {
      // If no deployment found, try to get the site directly
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', id)
        .single();
        
      if (siteError || !siteData) {
        return res.status(404).json({ error: 'Deployment or site not found' });
      }
      
      // TEMPORARY: Skip user authentication check
      // if (siteData.user_id !== userId) {
      //   return res.status(403).json({ error: 'Unauthorized access to site' });
      // }
      
      siteId = siteData.id;
      site = siteData;
    } else {
      // TEMPORARY: Skip user authentication check
      // if (deployment.user_id !== userId) {
      //   return res.status(403).json({ error: 'Unauthorized access to deployment' });
      // }
      
      // Get the site ID from the deployment
      siteId = deployment.site_id;
      site = deployment.sites;
      
      if (!siteId || !site) {
        return res.status(404).json({ error: 'Site not found for this deployment' });
      }
    }
    
    // Use the site ID to get the file
    const storagePath = `sites/${siteId}/${filePath}`;
    
    // Get the file URL
    const { data: publicUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    if (!publicUrl) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    return res.status(200).json({
      url: publicUrl.publicUrl,
      path: storagePath
    });
  } catch (error) {
    console.error('Error in getFileContent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
