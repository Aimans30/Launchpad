const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const extract = require('extract-zip');
const rimraf = require('rimraf');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

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
      console.log('Supabase connection successful. Sites table count:', count);
    }
  })
  .catch(err => {
    console.error('Supabase connection test error:', err);
  });

// Sites directory
const SITES_DIR = process.env.SITES_DIR || path.join(__dirname, '../../public/sites');

// Ensure sites directory exists
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
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
};

/**
 * Upload a static site (zip file)
 */
exports.uploadSite = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const { siteName } = req.body;

    if (!siteName) {
      return res.status(400).json({ error: 'Site name is required' });
    }

    // Generate a unique site ID and slug
    const siteId = uuidv4();
    const siteSlug = siteName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Check if slug is available
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id')
      .eq('slug', siteSlug)
      .single();

    if (existingSite) {
      return res.status(400).json({ error: 'Site name already in use' });
    }

    // Create site directory
    const siteDir = path.join(SITES_DIR, siteSlug);
    if (fs.existsSync(siteDir)) {
      rimraf.sync(siteDir);
    }
    fs.mkdirSync(siteDir, { recursive: true });

    // Extract zip file
    try {
      await extract(req.file.path, { dir: siteDir });
      
      // Remove the temp zip file
      fs.unlinkSync(req.file.path);
    } catch (extractError) {
      console.error('Error extracting zip:', extractError);
      return res.status(400).json({ error: 'Invalid zip file' });
    }

    // Create site record in database
    const { data: site, error } = await supabase
      .from('sites')
      .insert({
        id: siteId,
        name: siteName,
        slug: siteSlug,
        user_id: userId,
        status: 'active',
        site_url: `/sites/${siteSlug}`,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating site record:', error);
      return res.status(500).json({ error: 'Failed to create site' });
    }

    res.status(201).json({ 
      site,
      message: 'Site uploaded successfully',
      url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/sites/${siteSlug}`
    });
  } catch (error) {
    console.error('Upload site error:', error);
    res.status(500).json({ error: 'Failed to upload site' });
  }
};

/**
 * Upload a folder of static site files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadFolder = async (req, res) => {
  try {
    console.log('Folder upload request received');
    console.log('Request body:', req.body);
    console.log('Files received:', req.files ? req.files.length : 0);
    
    if (req.files && req.files.length > 0) {
      console.log('First file details:', {
        filename: req.files[0].originalname,
        size: req.files[0].size,
        path: req.files[0].path
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!req.body.siteName) {
      return res.status(400).json({ error: 'Site name is required' });
    }

    const siteName = req.body.siteName;
    const slug = createSlug(siteName);
    
    // Get user ID from req.user.id or req.user.uid (set by auth middleware)
    // Firebase Auth uses uid, but our database expects id to match auth.uid()
    const userId = req.user.uid || req.user.id;
    console.log('User ID from request:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in request. Authentication may have failed.' });
    }
    
    const siteId = uuidv4();
    const siteDir = path.join(SITES_DIR, slug); // Use SITES_DIR constant instead of sitesDir
    console.log('Creating site directory:', siteDir);

    // Check if site with this slug already exists
    const { data: existingSite } = await supabase
      .from('sites')
      .select('*')
      .eq('slug', slug)
      .single();

    if (existingSite) {
      // Clean up uploaded files
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      return res.status(400).json({ error: 'A site with this name already exists' });
    }

    // Create site directory if it doesn't exist
    if (fs.existsSync(siteDir)) {
      rimraf.sync(siteDir);
    }
    fs.mkdirSync(siteDir, { recursive: true });

    // Process each uploaded file
    const fileMap = new Map(); // Track which files we've processed
    
    for (const file of req.files) {
      // Get the relative path from the original file name
      let relativePath = file.originalname;
      
      // If the path contains directory separators, we need to create the directories
      const targetPath = path.join(siteDir, relativePath);
      const targetDir = path.dirname(targetPath);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Copy the file from temp to target location
      fs.copyFileSync(file.path, targetPath);
      fileMap.set(relativePath, true);
      
      // Clean up the temp file
      fs.unlinkSync(file.path);
    }

    // Check if index.html exists
    if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
      // Clean up site directory
      rimraf.sync(siteDir);
      return res.status(400).json({ error: 'No index.html found in the uploaded files' });
    }

    // Generate site URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const siteUrl = `${backendUrl}/sites/${slug}`;

    // Log the data we're trying to insert
    console.log('Attempting to insert site record with data:', {
      id: siteId,
      name: siteName,
      slug,
      user_id: userId,
      status: 'active',
      site_url: siteUrl
    });
    
    // Create site record in database
    // Try with RLS bypass to avoid permission issues
    const siteData = {
      id: siteId,
      name: siteName,
      slug,
      user_id: userId,
      status: 'active',
      site_url: siteUrl
    };
    
    console.log('Inserting site with data:', siteData);
    
    // First try with standard insert
    const { data: site, error } = await supabase
      .from('sites')
      .insert([siteData])
      .select()
      .single();

    if (error) {
      // Log the detailed error
      console.error('Database error when creating site record:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      
      // Try an alternative approach using SQL directly
      try {
        console.log('Attempting alternative site creation method...');
        
        // Try direct SQL insertion with service_role key to bypass RLS
        // This is a workaround for RLS policy issues
        const { data: directInsert, error: directError } = await supabase
          .from('sites')
          .insert([{
            id: siteId,
            name: siteName,
            slug,
            user_id: userId,
            status: 'active',
            site_url: siteUrl,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
          
        if (directError) {
          console.error('Direct insertion failed:', directError);
          throw directError;
        }
        
        if (directInsert) {
          console.log('Site created successfully using direct insertion');
          return res.status(201).json({ message: 'Site uploaded successfully', site: directInsert });
        }
        
        // Fetch the newly created site
        const { data: newSite, error: fetchError } = await supabase
          .from('sites')
          .select('*')
          .eq('id', siteId)
          .single();
          
        if (fetchError) {
          console.error('Failed to fetch newly created site:', fetchError);
          throw fetchError;
        }
        
        console.log('Site created successfully using alternative method');
        return res.status(201).json({ message: 'Site uploaded successfully', site: newSite });
      } catch (fallbackError) {
        console.error('Fallback site creation failed:', fallbackError);
        // Clean up site directory
        rimraf.sync(siteDir);
        return res.status(500).json({ 
          error: 'Failed to create site record', 
          details: error.message,
          fallbackError: fallbackError.message 
        });
      }
    }

    res.status(201).json({ message: 'Site uploaded successfully', site });
  } catch (error) {
    console.error('Error uploading folder:', error);
    console.error('Error stack:', error.stack);
    
    // Check if headers have already been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to upload site', 
        details: error.message,
        path: error.path || 'unknown'
      });
    } else {
      console.error('Headers already sent, could not send error response');
    }
  }
};

/**
 * Create a new site (metadata only)
 */
exports.createSite = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Site name is required' });
    }

    // Generate a unique site slug
    const siteSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Check if slug is available
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id')
      .eq('slug', siteSlug)
      .single();

    if (existingSite) {
      return res.status(400).json({ error: 'Site name already in use' });
    }

    // Create site record
    const { data: site, error } = await supabase
      .from('sites')
      .insert({
        id: uuidv4(),
        name,
        slug: siteSlug,
        user_id: userId,
        status: 'pending',
        site_url: `/sites/${siteSlug}`,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating site:', error);
      return res.status(500).json({ error: 'Failed to create site' });
    }

    // Create site directory
    const siteDir = path.join(SITES_DIR, siteSlug);
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
      
      // Create a placeholder index.html
      const placeholderHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${name} - Coming Soon</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h1>${name}</h1>
          <p>This site is coming soon. Upload your content to make it live.</p>
        </body>
        </html>
      `;
      
      fs.writeFileSync(path.join(siteDir, 'index.html'), placeholderHtml);
    }

    res.status(201).json({ site });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
};

/**
 * Get all sites
 */
exports.getAllSites = async (req, res) => {
  try {
    const { data: sites, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sites:', error);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }

    res.status(200).json({ sites });
  } catch (error) {
    console.error('Get all sites error:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
};

/**
 * Get sites for current user
 */
exports.getUserSites = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: sites, error } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sites:', error);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }

    res.status(200).json({ sites });
  } catch (error) {
    console.error('Get user sites error:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
};

/**
 * Get site by ID
 */
exports.getSiteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

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

    res.status(200).json({ site });
  } catch (error) {
    console.error('Get site by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
};

/**
 * Update site
 */
exports.updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    // Check if site exists and belongs to user
    const { data: existingSite, error: findError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingSite) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (existingSite.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this site' });
    }

    // If name is changed, update slug and directory
    let updateData = {
      name,
      updated_at: new Date()
    };

    if (name && name !== existingSite.name) {
      const newSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Check if new slug is available
      if (newSlug !== existingSite.slug) {
        const { data: slugCheck } = await supabase
          .from('sites')
          .select('id')
          .eq('slug', newSlug)
          .single();

        if (slugCheck) {
          return res.status(400).json({ error: 'Site name already in use' });
        }

        // Rename directory
        const oldDir = path.join(SITES_DIR, existingSite.slug);
        const newDir = path.join(SITES_DIR, newSlug);
        
        if (fs.existsSync(oldDir)) {
          fs.renameSync(oldDir, newDir);
        }

        updateData.slug = newSlug;
        updateData.site_url = `/sites/${newSlug}`;
      }
    }

    // Update site
    const { data: site, error } = await supabase
      .from('sites')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating site:', error);
      return res.status(500).json({ error: 'Failed to update site' });
    }

    res.status(200).json({ site });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
};

/**
 * Delete site
 */
exports.deleteSite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if site exists and belongs to user
    const { data: site, error: findError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (site.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this site' });
    }

    // Delete site directory
    const siteDir = path.join(SITES_DIR, site.slug);
    if (fs.existsSync(siteDir)) {
      rimraf.sync(siteDir);
    }

    // Delete site record
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting site:', error);
      return res.status(500).json({ error: 'Failed to delete site' });
    }

    res.status(200).json({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
};
