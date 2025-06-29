const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const rimraf = require('rimraf');
const { uploadFileToStorage, getPublicUrl, deleteFromStorage, ensureBucketExists } = require('../utils/storage');
// Import deployment functions
const { deploySite, getSiteEnvVars, setSiteEnvVars } = require('./site.deployment');

// Export the deployment functions from site.deployment.js
exports.deploySite = deploySite;
exports.getSiteEnvVars = getSiteEnvVars;
exports.setSiteEnvVars = setSiteEnvVars;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL or SUPABASE_KEY environment variables are not set');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.error('SUPABASE_KEY:', supabaseKey ? 'Set' : 'Not set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test the Supabase connection
supabase.from('sites').select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log(`✅ Supabase connection test successful. Found ${count} sites.`);
    }
  })
  .catch(err => {
    console.error('Supabase connection test error:', err);
  });

// Ensure sites directory exists
const SITES_DIR = path.join(__dirname, '../../public/sites');
if (!fs.existsSync(SITES_DIR)) {
  fs.mkdirSync(SITES_DIR, { recursive: true });
}

// Ensure temp uploads directory exists
const TEMP_DIR = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Create a URL-friendly slug from a string
 * @param {string} str - The string to convert to a slug
 * @returns {string} - The slug
 */
const createSlug = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
};

// Export all functions for routes
exports.createSlug = createSlug;

/**
 * Get all sites for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserSites = async (req, res) => {
  try {
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    console.log(`Getting sites for user: ${userId} (TEMPORARY TEST USER)`);
    
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user sites:', error);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in getUserSites:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload a folder of files for a site
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadFolder = async (req, res) => {
  try {
    const files = req.files;
    const { siteName, siteId } = req.body;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    console.log(`Received folder upload request with ${files ? files.length : 0} files`);
    console.log(`Site name: ${siteName}, Site ID: ${siteId}`);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Create a unique storage path for this site
    const storagePath = `sites/${userId}/${siteId || uuidv4()}`;
    console.log(`Storage path: ${storagePath}`);
    
    // Ensure the bucket exists
    const bucketExists = await ensureBucketExists('sites');
    if (!bucketExists) {
      return res.status(500).json({ error: 'Failed to ensure storage bucket exists' });
    }
    
    // Process and upload each file
    const uploadResults = [];
    const failedUploads = [];
    
    for (const file of files) {
      try {
        // Extract the relative path from the original file name
        const relativePath = file.originalname;
        const storageName = `${storagePath}/${relativePath}`;
        
        console.log(`Uploading file: ${file.path} to ${storageName}`);
        
        // Read the file content
        const fileContent = fs.readFileSync(file.path);
        
        // Upload to Supabase Storage
        const uploadResult = await uploadFileToStorage('sites', storageName, fileContent, {
          contentType: file.mimetype
        });
        
        if (uploadResult.success) {
          uploadResults.push({
            originalName: relativePath,
            storagePath: storageName,
            publicUrl: uploadResult.publicUrl,
            size: file.size
          });
        } else {
          failedUploads.push({
            originalName: relativePath,
            error: uploadResult.error
          });
          console.error(`Failed to upload ${relativePath}:`, uploadResult.error);
        }
        
        // Clean up the temporary file
        fs.unlinkSync(file.path);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        failedUploads.push({
          originalName: file.originalname,
          error: fileError.message
        });
      }
    }
    
    // Create or update the site record in the database
    let site;
    if (siteId) {
      // Update existing site
      const { data, error } = await supabase
        .from('sites')
        .update({
          storage_path: storagePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', siteId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating site record:', error);
        return res.status(500).json({ error: 'Failed to update site record' });
      }
      
      site = data;
    } else {
      // Create new site
      const { data, error } = await supabase
        .from('sites')
        .insert({
          name: siteName || 'New Site',
          slug: `site-${Date.now()}`,
          status: 'active',
          storage_path: storagePath,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating site record:', error);
        return res.status(500).json({ error: 'Failed to create site record' });
      }
      
      site = data;
    }
    
    // Find the index.html file to use as the site URL
    const indexFile = uploadResults.find(file => 
      file.originalName === 'index.html' || file.originalName.endsWith('/index.html')
    );
    
    // Update the site with the URL
    if (indexFile) {
      const siteUrl = indexFile.publicUrl;
      const { data: updatedSite, error: updateError } = await supabase
        .from('sites')
        .update({
          site_url: siteUrl
        })
        .eq('id', site.id)
        .select()
        .single();
      
      if (!updateError) {
        site = updatedSite;
      } else {
        console.error('Error updating site URL:', updateError);
      }
    }
    
    // Create a deployment record
    let deployment = null;
    try {
      const { data: deploymentData, error: deploymentError } = await supabase
        .from('deployments')
        .insert({
          site_id: site.id,
          user_id: userId,
          status: 'success',
          deployed_url: site.site_url,
          deployed_at: new Date().toISOString(),
          version: 1
        })
        .select()
        .single();
      
      if (deploymentError) {
        console.error('Error creating deployment record:', deploymentError);
      } else {
        deployment = deploymentData;
      }
    } catch (deploymentError) {
      console.error('Failed to create deployment:', deploymentError);
    }
    
    return res.status(200).json({
      success: true,
      site,
      deployment,
      uploaded: uploadResults.length,
      failed: failedUploads.length,
      failedFiles: failedUploads
    });
  } catch (error) {
    console.error('Error in uploadFolder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload a static site (zip file)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllSites = async (req, res) => {
  try {
    // TEMPORARY: Skip user authentication check
    // Check if user is admin (for now, just allow any authenticated user)
    // const userId = req.user.firebase_uid || req.user.id;
    
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching all sites:', error);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in getAllSites:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.uploadSite = async (req, res) => {
  try {
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const zipFile = req.file;
    const { siteName, siteId } = req.body;

    console.log(`Received site upload: ${zipFile.originalname} (${zipFile.size} bytes)`);
    console.log(`Site name: ${siteName}, Site ID: ${siteId}`);

    // Extract the zip file
    const extractDir = path.join(TEMP_DIR, `extract-${Date.now()}`);
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    const zip = new AdmZip(zipFile.path);
    zip.extractAllTo(extractDir, true);

    // Create a unique storage path for this site
    const storagePath = `sites/${userId}/${siteId || uuidv4()}`;
    console.log(`Storage path: ${storagePath}`);

    // Ensure the bucket exists
    const bucketExists = await ensureBucketExists('sites');
    if (!bucketExists) {
      return res.status(500).json({ error: 'Failed to ensure storage bucket exists' });
    }

    // Process and upload each file
    const uploadResults = [];
    const failedUploads = [];

    const processDirectory = async (dir, baseDir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          await processDirectory(fullPath, baseDir);
        } else {
          try {
            const storageName = `${storagePath}/${relativePath.replace(/\\/g, '/')}`;
            const fileContent = fs.readFileSync(fullPath);
            const contentType = entry.name.endsWith('.html') ? 'text/html' :
                               entry.name.endsWith('.css') ? 'text/css' :
                               entry.name.endsWith('.js') ? 'application/javascript' :
                               entry.name.endsWith('.json') ? 'application/json' :
                               entry.name.endsWith('.png') ? 'image/png' :
                               entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg') ? 'image/jpeg' :
                               entry.name.endsWith('.gif') ? 'image/gif' :
                               entry.name.endsWith('.svg') ? 'image/svg+xml' :
                               'application/octet-stream';

            const uploadResult = await uploadFileToStorage('sites', storageName, fileContent, {
              contentType
            });

            if (uploadResult.success) {
              uploadResults.push({
                originalName: relativePath,
                storagePath: storageName,
                publicUrl: uploadResult.publicUrl,
                size: fileContent.length
              });
            } else {
              failedUploads.push({
                originalName: relativePath,
                error: uploadResult.error
              });
              console.error(`Failed to upload ${relativePath}:`, uploadResult.error);
            }
          } catch (fileError) {
            console.error(`Error processing file ${relativePath}:`, fileError);
            failedUploads.push({
              originalName: relativePath,
              error: fileError.message
            });
          }
        }
      }
    };

    await processDirectory(extractDir, extractDir);

    // Clean up
    fs.unlinkSync(zipFile.path);
    rimraf.sync(extractDir);

    // Create or update the site record in the database
    let site;
    if (siteId) {
      // Update existing site
      const { data, error } = await supabase
        .from('sites')
        .update({
          storage_path: storagePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', siteId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating site record:', error);
        return res.status(500).json({ error: 'Failed to update site record' });
      }

      site = data;
    } else {
      // Create new site
      const { data, error } = await supabase
        .from('sites')
        .insert({
          name: siteName || 'New Site',
          slug: `site-${Date.now()}`,
          status: 'active',
          storage_path: storagePath,
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating site record:', error);
        return res.status(500).json({ error: 'Failed to create site record' });
      }

      site = data;
    }

    // Find the index.html file to use as the site URL
    const indexFile = uploadResults.find(file => 
      file.originalName === 'index.html' || file.originalName.endsWith('/index.html')
    );
    
    // Update the site with the URL
    if (indexFile) {
      const siteUrl = indexFile.publicUrl;
      const { data: updatedSite, error: updateError } = await supabase
        .from('sites')
        .update({
          site_url: siteUrl
        })
        .eq('id', site.id)
        .select()
        .single();
      
      if (!updateError) {
        site = updatedSite;
      } else {
        console.error('Error updating site URL:', updateError);
      }
    }
    
    // Create a deployment record
    let deployment = null;
    try {
      const { data: deploymentData, error: deploymentError } = await supabase
        .from('deployments')
        .insert({
          site_id: site.id,
          user_id: userId,
          status: 'success',
          deployed_url: site.site_url,
          deployed_at: new Date().toISOString(),
          version: 1
        })
        .select()
        .single();
      
      if (deploymentError) {
        console.error('Error creating deployment record:', deploymentError);
      } else {
        deployment = deploymentData;
      }
    } catch (deploymentError) {
      console.error('Failed to create deployment:', deploymentError);
    }
    
    return res.status(200).json({
      success: true,
      site,
      deployment,
      uploaded: uploadResults.length,
      failed: failedUploads.length,
      failedFiles: failedUploads
    });
  } catch (error) {
    console.error('Error in uploadSite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all sites (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllSites = async (req, res) => {
  try {
    // This endpoint could be restricted to admin users in the future
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching all sites:', error);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in getAllSites:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new site
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createSite = async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    if (!name) {
      return res.status(400).json({ error: 'Site name is required' });
    }
    
    // Generate a slug if not provided
    const siteSlug = slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    
    // Create the site record
    const { data: site, error } = await supabase
      .from('sites')
      .insert({
        name,
        slug: siteSlug,
        description: description || '',
        status: 'draft',
        user_id: userId,
        storage_path: `sites/${userId}/${uuidv4()}`
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating site:', error);
      return res.status(500).json({ error: 'Failed to create site' });
    }
    
    return res.status(201).json({ site });
  } catch (error) {
    console.error('Error in createSite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get site by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSiteById = async (req, res) => {
  try {
    const { id } = req.params;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Check if user has access to this site
    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to site' });
    }
    
    return res.status(200).json({ site });
  } catch (error) {
    console.error('Error in getSiteById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update a site
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, status } = req.body;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    // Check if site exists and belongs to user
    const { data: existingSite, error: fetchError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingSite) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    if (existingSite.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to site' });
    }
    
    // Update the site
    const updateData = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;
    updateData.updated_at = new Date().toISOString();
    
    const { data: updatedSite, error } = await supabase
      .from('sites')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating site:', error);
      return res.status(500).json({ error: 'Failed to update site' });
    }
    
    return res.status(200).json({ site: updatedSite });
  } catch (error) {
    console.error('Error in updateSite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a site
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteSite = async (req, res) => {
  try {
    const { id } = req.params;
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    console.log(`Attempting to delete site with ID: ${id}`);
    
    // Check if site exists and belongs to user
    const { data: existingSite, error: fetchError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching site for deletion:', fetchError);
      return res.status(404).json({ error: 'Site not found' });
    }
    
    if (!existingSite) {
      console.log('Site not found in database');
      return res.status(404).json({ error: 'Site not found' });
    }
    
    console.log(`Found site: ${existingSite.name} with storage_path: ${existingSite.storage_path}`);
    
    // TEMPORARY: Skip user ownership check
    // if (existingSite.user_id !== userId) {
    //   return res.status(403).json({ error: 'Unauthorized access to site' });
    // }
    
    // Delete the site's files from storage if it has a storage path
    if (existingSite.storage_path) {
      try {
        console.log(`Deleting files from storage path: ${existingSite.storage_path}`);
        
        // Use the storage path directly - it should already be in the correct format
        let storagePath = existingSite.storage_path;
        
        // Remove 'sites/' prefix if it exists to get the folder path within the bucket
        if (storagePath.startsWith('sites/')) {
          storagePath = storagePath.replace('sites/', '');
        }
        
        console.log(`Normalized storage path: ${storagePath}`);
        
        // List all files in the site's storage path
        const { data: storageFiles, error: listError } = await supabase
          .storage
          .from('sites')
          .list(storagePath);
        
        if (listError) {
          console.error('Error listing site files:', listError);
        } else if (storageFiles && storageFiles.length > 0) {
          console.log(`Found ${storageFiles.length} files to delete`);
          
          // Create paths for each file to delete
          const filePaths = storageFiles.map(file => `${storagePath}/${file.name}`);
          console.log('Files to delete:', filePaths);
          
          const { error: deleteError } = await supabase
            .storage
            .from('sites')
            .remove(filePaths);
          
          if (deleteError) {
            console.error('Error deleting site files:', deleteError);
          } else {
            console.log('Successfully deleted site files from storage');
          }
        } else {
          console.log('No files found to delete in storage');
        }
        
        // Also try to delete the folder itself if it exists
        try {
          const { error: folderDeleteError } = await supabase
            .storage
            .from('sites')
            .remove([storagePath]);
          
          if (folderDeleteError) {
            console.log('Could not delete folder (this is normal):', folderDeleteError.message);
          } else {
            console.log('Successfully deleted storage folder');
          }
        } catch (folderError) {
          console.log('Folder deletion attempt failed (this is normal):', folderError.message);
        }
      } catch (storageError) {
        console.error('Error handling storage deletion:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }
    
    // Delete any deployments associated with this site
    try {
      console.log('Deleting deployments associated with site');
      const { error: deploymentDeleteError } = await supabase
        .from('deployments')
        .delete()
        .eq('site_id', id);
      
      if (deploymentDeleteError) {
        console.error('Error deleting site deployments:', deploymentDeleteError);
      } else {
        console.log('Successfully deleted site deployments');
      }
    } catch (deploymentError) {
      console.error('Error deleting site deployments:', deploymentError);
    }
    
    // Delete any environment variables associated with this site
    try {
      console.log('Deleting environment variables associated with site');
      const { error: envVarDeleteError } = await supabase
        .from('site_env_vars')
        .delete()
        .eq('site_id', id);
      
      if (envVarDeleteError) {
        console.error('Error deleting site environment variables:', envVarDeleteError);
      } else {
        console.log('Successfully deleted site environment variables');
      }
    } catch (envVarError) {
      console.error('Error deleting site environment variables:', envVarError);
    }
    
    // Delete the site record from the database
    console.log('Deleting site record from database');
    const { error: siteDeleteError } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);
    
    if (siteDeleteError) {
      console.error('Error deleting site record:', siteDeleteError);
      return res.status(500).json({ error: 'Failed to delete site from database' });
    }
    
    console.log('Site deleted successfully');
    return res.status(200).json({ 
      success: true, 
      message: 'Site deleted successfully',
      deletedSite: {
        id: existingSite.id,
        name: existingSite.name
      }
    });
  } catch (error) {
    console.error('Error in deleteSite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all files for a specific site
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSiteFiles = async (req, res) => {
  try {
    const { siteId } = req.params;
    
    // TEMPORARY: Skip user authentication check
    // const userId = req.user.firebase_uid || req.user.id;
    // Use a default user ID for testing
    const userId = 'test-user';
    
    // First, get the site to verify it exists and to get the storage path
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();
    
    if (siteError || !site) {
      console.error('Error fetching site:', siteError);
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Get the storage path for this site
    const storagePath = site.storage_path;
    if (!storagePath) {
      return res.status(404).json({ error: 'No files found for this site' });
    }
    
    // List all files in the storage path
    const { data: files, error: listError } = await supabase
      .storage
      .from('sites')
      .list(storagePath, {
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (listError) {
      console.error('Error listing files:', listError);
      return res.status(500).json({ error: 'Failed to list files' });
    }
    
    // Get URLs for each file
    const fileList = await Promise.all(files.map(async (file) => {
      const filePath = `${storagePath}/${file.name}`;
      const { data: url } = supabase
        .storage
        .from('sites')
        .getPublicUrl(filePath);
      
      return {
        name: file.name,
        path: filePath,
        url: url?.publicUrl || null,
        size: file.metadata?.size || 0,
        type: file.metadata?.mimetype || 'application/octet-stream',
        lastModified: file.metadata?.lastModified || null
      };
    }));
    
    return res.status(200).json({
      site: {
        id: site.id,
        name: site.name,
        url: site.site_url
      },
      files: fileList
    });
  } catch (error) {
    console.error('Error in getSiteFiles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};