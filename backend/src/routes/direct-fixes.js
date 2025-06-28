/**
 * Direct route fixes for problematic endpoints
 * This module exports a function that adds direct route handlers to an Express app
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function addDirectRoutes(app) {
  console.log('Adding direct route handlers for problematic endpoints');
  
  // Log all registered routes for debugging
  console.log('Current routes:', app._router ? app._router.stack.length : 'No routes');
  
  // Ensure temp directory exists
  const tempDir = path.join(__dirname, '../../uploads/temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      // Preserve folder structure by using the original path
      const filePath = file.originalname;
      cb(null, `${Date.now()}-${filePath}`);
    }
  });
  
  // Error handling for multer
  const multerUpload = multer({
    storage,
    limits: { 
      fileSize: 100 * 1024 * 1024, // 100MB per file
      files: 1000, // Max 1000 files
      fieldSize: 100 * 1024 * 1024, // 100MB field size limit
      fieldNameSize: 100, // Max field name size
      parts: 2000, // Max number of parts (fields + files)
    }
  }).array('files');
  
  // Custom multer error handling wrapper
  const folderUpload = (req, res, next) => {
    multerUpload(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            error: 'File too large', 
            message: 'One or more files exceed the size limit of 100MB' 
          });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(413).json({ 
            error: 'Too many files', 
            message: 'You can upload a maximum of 1000 files at once' 
          });
        } else {
          return res.status(500).json({ 
            error: 'Upload failed', 
            message: err.message || 'Error processing upload' 
          });
        }
      }
      next();
    });
  };
  
  // Track uploads in progress
  const uploadsInProgress = new Map();
  
  // Use OS for temp directory
  const os = require('os');
  
  // Enhanced upload configuration with higher limits
  const enhancedUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, os.tmpdir()); // Use system temp directory for better performance
      },
      filename: (req, file, cb) => {
        // Preserve folder structure by using the original path
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
      }
    }),
    limits: {
      fileSize: 150 * 1024 * 1024, // 150MB per file
      files: 200, // Max 200 files per request
      fieldSize: 200 * 1024 * 1024 // 200MB field size
    }
  });
  
  // Direct handler for the upload-folder endpoint
  app.post('/api/sites/upload-folder', enhancedUpload.any(), async (req, res) => {
    console.log('[DIRECT FIX] Upload folder endpoint accessed');
    console.log('Files received:', req.files ? req.files.length : 0);
    console.log('Request body:', req.body);
    console.log('Auth header:', req.headers.authorization ? 'Present' : 'Missing');
    
    try {
      const files = req.files || [];
      const { siteName, siteId } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      
      console.log(`Received folder upload with ${files.length} files`);
      console.log(`Site name: ${siteName}, Site ID: ${siteId}`);
      
      // Initialize Supabase client
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
      );
      
      // Extract user information from token if present
      let userId = null;
      let userEmail = null;
      let username = null;
      
      if (req.headers.authorization) {
        try {
          const admin = require('firebase-admin');
          const token = req.headers.authorization.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          userId = decodedToken.uid;
          userEmail = decodedToken.email || null;
          
          console.log('Authenticated user:', userId);
          
          // Get user details from Supabase
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', userId)
            .single();
          
          if (!userError && userData) {
            username = userData.github_username || userEmail;
            console.log('Found user in database:', username);
          }
        } catch (authError) {
          console.error('Authentication error:', authError);
          // Continue without user association
        }
      }
      
      // Initialize variables that will be set after checking for chunked upload
      let actualSiteId;
      const bucketName = 'sites';
      let siteFolderPath;
      
      console.log(`Uploading files to Supabase bucket: ${bucketName}, path: ${siteFolderPath}`);
      
      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        return res.status(500).json({ error: 'Failed to access storage', message: bucketsError.message });
      }
      
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      if (!bucketExists) {
        console.log(`Bucket '${bucketName}' does not exist, creating...`);
        const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
          public: true
        });
        
        if (createBucketError) {
          console.error('Error creating bucket:', createBucketError);
          return res.status(500).json({ error: 'Failed to create storage bucket', message: createBucketError.message });
        }
      }
      
      // Extract chunk information if it exists
      const { siteId: uploadSiteId, chunkNumber, totalChunks } = req.body;
      const isChunkedUpload = uploadSiteId && chunkNumber && totalChunks;
      
      console.log(`Starting upload of ${files.length} files to Supabase`);
      if (isChunkedUpload) {
        console.log(`Chunk ${chunkNumber} of ${totalChunks}, Site ID: ${uploadSiteId}`);
      }
      
      // Use the provided siteId or generate a new one
      actualSiteId = uploadSiteId || `site-${Date.now()}`;
      siteFolderPath = `${actualSiteId}/`;
      
      // Keep track of chunked uploads
      if (isChunkedUpload) {
        // Initialize tracking for this site if it doesn't exist
        if (!uploadsInProgress.has(actualSiteId)) {
          uploadsInProgress.set(actualSiteId, {
            chunks: new Set(),
            totalChunks: parseInt(totalChunks, 10),
            siteName,
            userId,
            username,
            createdAt: new Date().toISOString(),
            filesUploaded: 0
          });
        }
        
        const uploadInfo = uploadsInProgress.get(actualSiteId);
        uploadInfo.chunks.add(parseInt(chunkNumber, 10));
      }
      
      // Process uploads in batches to avoid memory issues
      const batchSize = 5; // Reduce to 5 files at a time for better stability
      const uploadResults = [];
      let processedCount = 0;
      let failedCount = 0;
      
      try {
        // Loop through files in batches
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.length} files`);
          
          // Use Promise.all for each batch
          const batchResults = await Promise.all(
            batch.map(async (file) => {
              const relativePath = file.originalname;
              const filePath = `${siteFolderPath}${relativePath}`;
              
              try {
                // Create a read stream for the file
                const fileStream = fs.createReadStream(file.path);
                const fileBuffer = await new Promise((resolve, reject) => {
                  const chunks = [];
                  fileStream.on('data', chunk => chunks.push(chunk));
                  fileStream.on('error', reject);
                  fileStream.on('end', () => resolve(Buffer.concat(chunks)));
                });
                
                // Upload to Supabase
                const { error: uploadError } = await supabase.storage
                  .from(bucketName)
                  .upload(filePath, fileBuffer, {
                    contentType: file.mimetype,
                    upsert: true
                  });
                
                if (uploadError) {
                  console.error(`Error uploading ${filePath}:`, uploadError);
                  failedCount++;
                  return { path: filePath, error: uploadError.message, success: false };
                }
                
                processedCount++;
                if (processedCount % 10 === 0 || processedCount === files.length) {
                  console.log(`Uploaded ${processedCount}/${files.length} files`);
                }
                
                return { path: filePath, size: file.size, success: true };
                
              } catch (err) {
                console.error(`Error processing file ${relativePath}:`, err);
                failedCount++;
                return { path: filePath, error: err.message, success: false };
              }
            })
          );
          
          uploadResults.push(...batchResults);
        }
        
        if (isChunkedUpload) {
          const uploadInfo = uploadsInProgress.get(actualSiteId);
          uploadInfo.filesUploaded += processedCount;
          console.log(`Chunk ${chunkNumber}/${totalChunks} complete for site ${actualSiteId}. Total files so far: ${uploadInfo.filesUploaded}`);
        }
        console.log(`Successfully uploaded ${uploadResults.length} files to Supabase`);
        
        // Create a site record in the sites table
        const currentTime = new Date().toISOString();
        
        // Generate a proper UUID for the site - required for Supabase
        const { v4: uuidv4 } = require('uuid');
        const properUuid = uuidv4();
        
        // Store mapping between display ID and database UUID
        console.log(`Converting site ID ${actualSiteId} to proper UUID format: ${properUuid}`);
        
        const siteData = {
          id: properUuid, // Use proper UUID format required by Supabase
          display_id: actualSiteId, // Store the original ID for reference
          name: siteName,
          user_id: userId,
          status: 'active',
          created_at: currentTime,
          updated_at: currentTime
        };
        
        // Insert the site record into the database
        const { data: insertedSite, error: insertError } = await supabase
          .from('sites')
          .insert([siteData])
          .select()
          .single();
        
        if (insertError) {
          console.error('Error inserting site record:', insertError);
          // Continue anyway since files were uploaded successfully
        } else {
          console.log('Site record inserted:', insertedSite);
        }
        
        // Get the site for response
        const site = insertedSite || {
          ...siteData,
          username: username || userEmail || 'anonymous'
        };
        
        // Public URL for the site
        const siteUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${siteFolderPath}index.html`;
        
        // Return success response
        return res.status(201).json({
          success: true,
          message: 'Files uploaded successfully to Supabase',
          filesReceived: files.length,
          siteName,
          siteId: actualSiteId,
          site: {
            ...site,
            url: siteUrl
          }
        });
      } catch (uploadError) {
        console.error('Error during file uploads:', uploadError);
        return res.status(500).json({
          error: 'Upload to Supabase failed',
          message: uploadError.message
        });
      }
    } catch (error) {
      console.error('[DIRECT FIX] Error in upload-folder handler:', error);
      return res.status(500).json({
        error: 'Upload processing failed',
        message: error.message
      });
    }
  });
  
  // Handler for finalizing uploads
  app.post('/api/sites/finalize-upload', async (req, res) => {
    console.log('[DIRECT FIX] Finalize upload endpoint accessed');
    console.log('Request body:', req.body);
    
    try {
      // Check auth
      let userId = null;
      let userEmail = null;
      let username = null;
      
      if (req.headers.authorization) {
        try {
          const admin = require('firebase-admin');
          const token = req.headers.authorization.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          userId = decodedToken.uid;
          userEmail = decodedToken.email || null;
          
          // Get user details from Supabase
          const { createClient } = require('@supabase/supabase-js');
          const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
          );
          
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', userId)
            .single();
          
          if (!userError && userData) {
            username = userData.github_username || userEmail;
          }
        } catch (authError) {
          console.error('Authentication error:', authError);
        }
      }
      
      const { siteId, siteName, totalFiles } = req.body;
      
      if (!siteId) {
        return res.status(400).json({ error: 'Missing siteId' });
      }
      
      // Check if this site is being tracked as a chunked upload
      const uploadInfo = uploadsInProgress.get(siteId);
      const bucketName = 'sites';
      const siteFolderPath = `${siteId}/`;
      
      // Initialize Supabase client
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
      );
      
      // Create a site record in the database
      const currentTime = new Date().toISOString();
      const siteData = {
        id: siteId,
        name: siteName || (uploadInfo ? uploadInfo.siteName : 'Uploaded Site'),
        user_id: userId || (uploadInfo ? uploadInfo.userId : null),
        status: 'active',
        created_at: currentTime,
        updated_at: currentTime,
        files_count: uploadInfo ? uploadInfo.filesUploaded : (totalFiles || 0),
        last_deployed: currentTime
      };
      
      // Insert the site record into the database
      const { data: insertedSite, error: insertError } = await supabase
        .from('sites')
        .insert([siteData])
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting site record:', insertError);
      } else {
        console.log('Site record inserted:', insertedSite);
      }
      
      // Public URL for the site
      const siteUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${siteFolderPath}index.html`;
      
      // Clean up upload tracking
      if (uploadInfo) {
        uploadsInProgress.delete(siteId);
      }
      
      // Return success response with site info
      return res.status(201).json({
        success: true,
        message: 'Upload finalized successfully',
        site: {
          ...insertedSite || siteData,
          url: siteUrl,
          username: username || userEmail || 'anonymous'
        }
      });
    } catch (error) {
      console.error('[DIRECT FIX] Error in finalize-upload handler:', error);
      return res.status(500).json({
        error: 'Failed to finalize upload',
        message: error.message
      });
    }
  });
  
  // Direct handler for the user sites endpoint
  app.get('/api/sites/user', async (req, res) => {
    console.log('[DIRECT FIX] User sites endpoint accessed');
    console.log('Auth header:', req.headers.authorization ? 'Present' : 'Missing');
    
    try {
      // Initialize Supabase client
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
      );
      
      // Extract user information from token if present
      let userId = null;
      
      if (req.headers.authorization) {
        try {
          const admin = require('firebase-admin');
          const token = req.headers.authorization.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(token);
          userId = decodedToken.uid;
          console.log('Authenticated user:', userId);
        } catch (authError) {
          console.error('Authentication error:', authError);
          return res.status(401).json({ error: 'Authentication failed', message: authError.message });
        }
      }
      
      // First try to get sites from the database
      let userSites = [];
      if (userId) {
        // Get user sites from the database
        const { data: dbSites, error: dbError } = await supabase
          .from('sites')
          .select('*')
          .eq('user_id', userId);
          
        if (!dbError && dbSites && dbSites.length > 0) {
          userSites = dbSites;
          console.log(`Found ${userSites.length} sites in database for user ${userId}`);
        }
      }
      
      // If no sites found in DB or no user ID, fall back to storage approach
      if (userSites.length === 0) {
        console.log('No sites found in database, checking storage...');
        
        const bucketName = 'sites';
        
        // List all folders in the sites bucket
        const { data: objects, error: listError } = await supabase.storage
          .from(bucketName)
          .list();
        
        if (listError) {
          console.error('Error listing objects in bucket:', listError);
          return res.status(500).json({ 
            error: 'Failed to fetch sites', 
            message: listError.message 
          });
        }
        
        // Extract unique site IDs from folder paths
        const siteIds = new Set();
        objects?.forEach(obj => {
          if (obj.name.includes('/')) {
            const siteId = obj.name.split('/')[0];
            siteIds.add(siteId);
          } else {
            // It's a direct folder
            siteIds.add(obj.name);
          }
        });
        
        // Convert to array of site objects
        userSites = Array.from(siteIds).map(id => ({
          id,
          name: id.startsWith('site-') ? `Site ${id.substring(5)}` : id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active',
          user_id: userId // associate with current user if authenticated
        }));
        
        console.log(`Found ${userSites.length} sites in Supabase storage`);
      }
      
      // Add URLs for each site
      const sitesWithUrls = userSites.map(site => {
        const bucketName = 'sites';
        // Use display_id for the path if available, otherwise fall back to id
        const folderIdToUse = site.display_id || site.id;
        const siteFolderPath = `${folderIdToUse}/`;
        // Use our proxy endpoint instead of direct Supabase URL to ensure proper content type
        const siteUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/sites/${folderIdToUse}/view`;
        
        return {
          ...site,
          url: siteUrl,
          // Add display_id back to the response if it wasn't already there
          display_id: site.display_id || (site.id.includes('site-') ? site.id : `site-${Date.now()}`)
        };
      });
      
      return res.status(200).json(sitesWithUrls);
    } catch (error) {
      console.error('[DIRECT FIX] Error in user sites handler:', error);
      return res.status(500).json({
        error: 'Failed to fetch sites',
        message: error.message
      });
    }
  });
  
  // Add endpoint for viewing site files
  app.get('/api/sites/:siteId/files', middleware.auth.authMiddleware, async (req, res) => {
    console.log('[DIRECT FIX] Site files endpoint accessed for site:', req.params.siteId);
    
    try {
      // Initialize Supabase client
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
      );
      
      const { siteId } = req.params;
      const bucketName = 'sites';
      
      // Find if this is a UUID or a display_id
      const isUuid = siteId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // If it's a UUID, we need to get the display_id from the database
      let folderIdToUse = siteId;
      
      if (isUuid) {
        console.log('Looking up display_id for UUID:', siteId);
        const { data: siteData } = await supabase
          .from('sites')
          .select('display_id')
          .eq('id', siteId)
          .maybeSingle();
          
        if (siteData && siteData.display_id) {
          folderIdToUse = siteData.display_id;
          console.log('Found display_id:', folderIdToUse);
        }
      }
      
      // List files in the site folder
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(folderIdToUse, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });
      
      if (error) {
        console.error('Error listing files:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to list files',
          details: error.message
        });
      }
      
      // Generate URLs for each file
      const filesWithUrls = files.map(file => {
        const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${folderIdToUse}/${file.name}`;
        return {
          ...file,
          url: fileUrl
        };
      });
      
      // Return HTML page with file list
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Files for site ${folderIdToUse}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 2rem; max-width: 1200px; margin: 0 auto; }
            h1 { color: #333; }
            .file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
            .file-item { padding: 1rem; border: 1px solid #eee; border-radius: 6px; }
            .file-item:hover { background: #f9f9f9; }
            a { color: #0070f3; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .back-link { margin-bottom: 2rem; display: inline-block; }
            .empty-state { text-align: center; padding: 3rem 0; color: #666; }
            .file-size { color: #666; font-size: 0.9rem; }
            header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
          </style>
        </head>
        <body>
          <header>
            <h1>Files for site ${folderIdToUse}</h1>
            <a href="${process.env.API_URL || 'http://localhost:3001'}/api/sites/${folderIdToUse}/view" target="_blank" class="view-site">View Live Site</a>
          </header>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/sites" class="back-link">← Back to sites</a>
          
          ${filesWithUrls.length === 0 ? 
            '<div class="empty-state">No files found in this site folder.</div>' :
            `<div class="file-list">
              ${filesWithUrls.map(file => `
                <div class="file-item">
                  <div><a href="${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${folderIdToUse}/${file.name}" target="_blank">${file.name}</a></div>
                  <div class="file-size">${(file.metadata?.size/1024).toFixed(1)} KB</div>
                </div>
              `).join('')}
            </div>`
          }
        </body>
        </html>
      `);
    } catch (error) {
      console.error('[DIRECT FIX] Error in site files handler:', error);
      return res.status(500).json({
        status: 'error',
        message: 'An error occurred while listing files',
        details: error.message
      });
    }
  });
  
  // Serve static files from the public directory
  app.use('/public', express.static(path.join(__dirname, '../../public')));
  
  // Add endpoint for site viewing with iframe wrapper
  app.get('/api/sites/:siteId/view', async (req, res) => {
    console.log('[DIRECT FIX] Site view accessed for site:', req.params.siteId);
    
    try {
      const { siteId } = req.params;
      
      // Serve the static HTML viewer with the site ID as a query parameter
      const viewerPath = path.join(__dirname, '../../public/site-viewer.html');
      
      // Check if the viewer file exists
      if (!fs.existsSync(viewerPath)) {
        console.error('Site viewer HTML file not found at:', viewerPath);
        return res.status(404).send('Site viewer not found');
      }
      
      // Read the HTML file
      const html = fs.readFileSync(viewerPath, 'utf8');
      
      // Replace placeholders with actual values
      const modifiedHtml = html
        .replace('const siteId = urlParams.get(\'siteId\');', `const siteId = '${siteId}';`)
        .replace('const supabaseUrl = urlParams.get(\'supabaseUrl\');', `const supabaseUrl = '${process.env.SUPABASE_URL}';`);
      
      // Send the HTML with the correct content type
      res.setHeader('Content-Type', 'text/html');
      res.send(modifiedHtml);
    } catch (error) {
      console.error('[DIRECT FIX] Error in site view:', error);
      return res.status(500).send(`Error: ${error.message}`);
    }
  });
  
  // Add endpoint for direct file content access with proper content type
  app.get('/api/sites/:siteId/raw/:filename(*)', async (req, res) => {
    console.log('[DIRECT FIX] Raw file access for site:', req.params.siteId, 'file:', req.params.filename);
    
    try {
      // Initialize Supabase client
      const { createClient } = require('@supabase/supabase-js');
      const axios = require('axios');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
      );
      
      const { siteId, filename } = req.params;
      const bucketName = 'sites';
      
      // Security check to prevent directory traversal
      if (filename.includes('../') || filename.includes('..\\')) {
        return res.status(403).json({ error: 'Invalid file path' });
      }
      
      // Construct full path to the file in storage
      const fullPath = `${siteId}/${filename}`;
      console.log(`Fetching raw file: ${fullPath}`);
      
      // Get the public URL for the file
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fullPath);
      
      if (!urlData || !urlData.publicUrl) {
        return res.status(404).send('File not found');
      }
      
      // Fetch the file content using axios
      const response = await axios.get(urlData.publicUrl, { responseType: 'arraybuffer' });
      
      // Set appropriate content type based on file extension
      const ext = filename.split('.').pop().toLowerCase();
      const contentTypes = {
        'html': 'text/html',
        'htm': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'txt': 'text/plain',
        'pdf': 'application/pdf',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'eot': 'application/vnd.ms-fontobject',
        'otf': 'font/otf',
        'xml': 'application/xml',
        'webp': 'image/webp',
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      
      // Send the file content
      return res.send(response.data);
    } catch (error) {
      console.error('[DIRECT FIX] Error in raw file access:', error);
      return res.status(500).send(`Error: ${error.message}`);
    }
  });
  console.log('Direct route handlers added successfully');
  return app;
};
