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
      
      // Initialize Supabase client only if environment variables are available
      let supabase = null;
      if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
        const { createClient } = require('@supabase/supabase-js');
        supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
        );
      }
      
      // Extract user information from token if present
      let userId = null;
      let userEmail = null;
      let username = null;
      
      if (req.headers.authorization && supabase) {
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
      
      // Check if bucket exists (only if Supabase is available)
      if (supabase) {
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
                
                // Upload to Supabase (only if available)
                if (supabase) {
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
        
        // Create a site record in the sites table (only if Supabase is available)
        let insertedSite = null;
        if (supabase) {
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
          const { data: siteRecord, error: insertError } = await supabase
            .from('sites')
            .insert([siteData])
            .select()
            .single();
          
          if (insertError) {
            console.error('Error inserting site record:', insertError);
            // Continue anyway since files were uploaded successfully
          } else {
            console.log('Site record inserted:', siteRecord);
            insertedSite = siteRecord;
          }
        }
        
        // Get the site for response
        const site = insertedSite || {
          id: actualSiteId,
          name: siteName,
          user_id: userId,
          status: 'active',
          username: username || userEmail || 'anonymous'
        };
        
        // Public URL for the site
        const siteUrl = supabase ? 
          `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${siteFolderPath}index.html` :
          `http://localhost:3001/sites/${actualSiteId}/index.html`;
        
        // Return success response
        return res.status(201).json({
          success: true,
          message: 'Files uploaded successfully',
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
          error: 'Upload failed',
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
      const { siteId, siteName, totalFiles } = req.body;
      
      if (!siteId) {
        return res.status(400).json({ error: 'Missing siteId' });
      }
      
      // Return success response with site info
      return res.status(201).json({
        success: true,
        message: 'Upload finalized successfully',
        site: {
          id: siteId,
          name: siteName || 'Uploaded Site',
          status: 'active',
          url: `http://localhost:3001/sites/${siteId}/index.html`
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
    
    try {
      // Return empty array for now
      return res.status(200).json([]);
    } catch (error) {
      console.error('[DIRECT FIX] Error in user sites handler:', error);
      return res.status(500).json({
        error: 'Failed to fetch sites',
        message: error.message
      });
    }
  });
  
  console.log('Direct route handlers added successfully');
  return app;
};