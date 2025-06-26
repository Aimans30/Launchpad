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
    const userId = req.user.firebase_uid || req.user.id;
    console.log(`Getting sites for user: ${userId}`);
    
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
    const userId = req.user.firebase_uid || req.user.id;
    
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
          status: 'draft',
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
    
    return res.status(200).json({
      success: true,
      site,
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
exports.uploadSite = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { siteName, siteId } = req.body;
    const userId = req.user.firebase_uid || req.user.id;
    const zipFile = req.file;

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
          status: 'draft',
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

    return res.status(200).json({
      success: true,
      site,
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
    const userId = req.user.firebase_uid || req.user.id;
    
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
    const userId = req.user.firebase_uid || req.user.id;
    
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
    const userId = req.user.firebase_uid || req.user.id;
    
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
    const userId = req.user.firebase_uid || req.user.id;
    
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
    
    // Delete the site's files from storage if it has a storage path
    if (existingSite.storage_path) {
      try {
        // Delete all files in the site's storage path
        const { data: storageFiles, error: listError } = await supabase
          .storage
          .from('sites')
          .list(existingSite.storage_path.replace('sites/', ''));
        
        if (!listError && storageFiles && storageFiles.length > 0) {
          const filePaths = storageFiles.map(file => 
            `${existingSite.storage_path.replace('sites/', '')}/${file.name}`);
          
          const { error: deleteError } = await supabase
            .storage
            .from('sites')
            .remove(filePaths);
          
          if (deleteError) {
            console.error('Error deleting site files:', deleteError);
          }
        }
      } catch (storageError) {
        console.error('Error handling storage deletion:', storageError);
      }
    }
    
    // Delete any deployments associated with this site
    try {
      await supabase
        .from('deployments')
        .delete()
        .eq('site_id', id);
    } catch (deploymentError) {
      console.error('Error deleting site deployments:', deploymentError);
    }
    
    // Delete any environment variables associated with this site
    try {
      await supabase
        .from('site_env_vars')
        .delete()
        .eq('site_id', id);
    } catch (envVarError) {
      console.error('Error deleting site environment variables:', envVarError);
    }
    
    // Delete the site record
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting site record:', error);
      return res.status(500).json({ error: 'Failed to delete site' });
    }
    
    return res.status(200).json({ success: true, message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Error in deleteSite:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
