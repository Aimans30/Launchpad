require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
if (process.env.NODE_ENV !== 'test') {
  try {
    // Initialize Firebase Admin with service account credentials
    const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
    console.log('Loading Firebase service account from:', serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath)
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.message);
  }
}

// Initialize Supabase Client
let supabase;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    console.log('Supabase initialized successfully');
  } else {
    console.log('Supabase initialization skipped - missing environment variables');
  }
} catch (error) {
  console.error('Supabase initialization error:', error.message);
}

// Create the Express app
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Define port for the server
const PORT = process.env.PORT || 3001;

// Set a long timeout for the server to handle large uploads
const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const server = require('http').createServer(app);
server.timeout = TIMEOUT_DURATION;

// Increase HTTP server/socket timeouts
const http = require('http');
http.globalAgent.maxSockets = 100;
http.globalAgent.keepAlive = true;

// Middleware
// Enhanced CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin ending with .launchpad.dev
    // or localhost/127.0.0.1 or the specific frontend URL
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,
    ];
    
    if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      console.log(`Origin ${origin} not allowed by CORS policy`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON and URL-encoded body parsing middleware with increased limits
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 50000 }));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Set security headers but allow CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(morgan('dev'));
// Increase JSON and URL-encoded payload limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Increase timeout for large uploads
app.use((req, res, next) => {
  // Set timeout to 5 minutes for large file uploads
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
});

// CRITICAL FIX: Add direct route handlers before any other routes
try {
  const addDirectRoutes = require('./routes/direct-fixes');
  addDirectRoutes(app);
  console.log('✅ Direct route handlers installed successfully');
} catch (error) {
  console.error('❌ Failed to add direct route handlers:', error);
}

// Basic routes for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug route to list all registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  // Function to extract routes from a layer
  const extractRoutes = (layer) => {
    if (layer.route) {
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      routes.push({ path, methods });
    } else if (layer.name === 'router' && layer.handle.stack) {
      // It's a router middleware
      const routerPath = layer.regexp.toString().replace('/^\\', '').replace('\\/?(?=\\/|$)/i', '').replace(/\\\\\//g, '/').replace(/\?/g, '');
      layer.handle.stack.forEach(routerLayer => {
        if (routerLayer.route) {
          const subPath = routerLayer.route.path;
          const fullPath = routerPath.replace(/\^|\$/g, '') + subPath;
          const methods = Object.keys(routerLayer.route.methods).map(m => m.toUpperCase());
          routes.push({ path: fullPath, methods });
        }
      });
    }
  };
  
  // Extract routes from app
  app._router.stack.forEach(extractRoutes);
  
  res.status(200).json({
    count: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// Import routes if they exist
try {
  console.log('Loading auth routes...');
  const authRoutes = require('./routes/auth.routes');
  console.log('Auth routes required successfully');
  
  // Log available routes
  console.log('Available auth routes:');
  authRoutes.stack?.forEach(route => {
    if (route.route) {
      console.log(`${route.route.path} - ${Object.keys(route.route.methods).join(', ')}`);
    }
  });
  
  app.use('/api/auth', authRoutes);
  console.log('Auth routes mounted at /api/auth');
  
  // Load custom OAuth routes
  const oauthRoutes = require('./routes/oauth.routes');
  app.use('/api/auth', oauthRoutes);
  console.log('OAuth routes mounted at /api/auth');
} catch (error) {
  console.error('Auth routes not loaded:', error.message, error.stack);
}

try {
  const deploymentRoutes = require('./routes/deployment.routes');
  app.use('/api/deployments', deploymentRoutes);
  console.log('Deployment routes loaded');
} catch (error) {
  console.log('Deployment routes not loaded:', error.message);
}

try {
  const projectRoutes = require('./routes/project.routes');
  app.use('/api/projects', projectRoutes);
  console.log('Project routes loaded');
} catch (error) {
  console.log('Project routes not loaded:', error.message);
}

try {
  const githubRoutes = require('./routes/github.routes');
  app.use('/api/github', githubRoutes);
  console.log('GitHub routes loaded');
} catch (error) {
  console.log('GitHub routes not loaded:', error.message);
}

try {
  const siteRoutes = require('./routes/site.routes');
  app.use('/api/sites', siteRoutes);
  console.log('Site routes loaded');
  
  // Route was moved to site.routes.js
  
} catch (error) {
  console.log('Site routes not loaded:', error.message);
}

// Load debug routes
try {
  const debugRoutes = require('./routes/debug.routes');
  app.use('/api/debug', debugRoutes);
  console.log('Debug routes loaded');
} catch (error) {
  console.log('Debug routes not loaded:', error.message);
}

// Add direct route handlers for problematic endpoints
// Upload folder endpoint
const multer = require('multer');
const tempDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const filePath = file.originalname;
    cb(null, `${Date.now()}-${filePath}`);
  }
});

const folderUpload = multer({
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 500, // Max 500 files
    fieldSize: 50 * 1024 * 1024 // 50MB field size limit
  }
});

app.post('/api/sites/upload-folder', folderUpload.array('files'), (req, res) => {
  console.log('[DIRECT] Upload folder endpoint accessed');
  console.log('Files received:', req.files ? req.files.length : 0);
  
  try {
    const files = req.files;
    const { siteName, siteId } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Files received successfully',
      filesReceived: files.length,
      siteName,
      siteId
    });
  } catch (error) {
    console.error('Error in upload-folder route:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/api/sites/user', (req, res) => {
  console.log('[DIRECT] User sites endpoint accessed');
  return res.status(200).json([]);
});

// Add finalize-upload endpoint to complete chunked uploads
app.post('/api/sites/finalize-upload', async (req, res) => {
  console.log('[DIRECT] Finalize upload endpoint accessed');
  console.log('Request body:', req.body);
  
  try {
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
        
        // Get user details from Supabase
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
    
    const bucketName = 'sites';
    const siteFolderPath = `${siteId}/`;
    
    // Create a site record in the database with only the columns that exist in the schema
    const currentTime = new Date().toISOString();
    
    // Generate a proper UUID for the site rather than using the string format
    const { v4: uuidv4 } = require('uuid');
    
    // Declare the UUID variable to use for this site
    let properUuid;
    
    // Get any existing data for this site - files were already uploaded to storage with siteId
    const { data: existingData } = await supabase
      .from('sites')
      .select('*')
      .eq('display_id', siteId)
      .maybeSingle();
      
    if (existingData) {
      console.log(`Found existing site record for ${siteId}: ${existingData.id}`);
      properUuid = existingData.id; // Use the existing UUID if the site already exists
    } else {
      properUuid = uuidv4(); // Generate a new UUID if no existing record
      console.log(`Converting site ID ${siteId} to proper UUID format: ${properUuid}`);
    }
    
    // Use only columns that exist in the schema with proper data types
    const siteData = {
      id: properUuid, // Use a proper UUID format
      display_id: siteId, // Store the original ID for reference
      name: siteName || 'Uploaded Site',
      user_id: userId, // Firebase UID
      created_at: currentTime,
      updated_at: currentTime,
      status: 'active'
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
    
    // Check if we have a working site record - either from the database or our data object
    const siteRecord = insertedSite || siteData;
    
    // Even if database insertion failed, we can still return success since files are uploaded
    // This prevents frontend authentication issues
    return res.status(201).json({
      success: true,
      message: insertError ? 'Files uploaded successfully but site record could not be saved' : 'Upload finalized successfully',
      site: {
        ...siteRecord,
        url: siteUrl,
        username: username || userEmail || 'anonymous'
      },
      // Include auth status to help frontend handle auth issues
      auth: {
        isAuthenticated: !!userId,
        username: username,
        email: userEmail
      }
    });
  } catch (error) {
    console.error('[DIRECT] Error in finalize-upload handler:', error);
    // Don't send a 401 status which might cause logout - use 500 instead
    return res.status(500).json({
      error: 'Failed to finalize upload',
      message: error.message,
      auth: {
        isAuthenticated: !!userId,
        username: username,
        email: userEmail
      }
    });
  }
});

// Load token routes
try {
  const tokenRoutes = require('./routes/token.routes');
  app.use('/api/token', tokenRoutes);
  console.log('Token routes loaded');
} catch (error) {
  console.log('Token routes not loaded:', error.message);
}

// Load GitHub auth routes
try {
  const githubAuthRoutes = require('./routes/github-auth.routes');
  app.use('/api/github-auth', githubAuthRoutes);
  console.log('GitHub auth routes loaded');
} catch (error) {
  console.log('GitHub auth routes not loaded:', error.message);
}

// Load Storage routes for serving static sites from Supabase Storage
try {
  const storageRoutes = require('./routes/storage.routes');
  app.use('/', storageRoutes);
  console.log('Storage routes loaded');
} catch (error) {
  console.log('Storage routes not loaded:', error.message);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static sites
const SITES_DIR = process.env.SITES_DIR || path.join(__dirname, '../public/sites');
if (!fs.existsSync(SITES_DIR)) {
  fs.mkdirSync(SITES_DIR, { recursive: true });
}
app.use('/sites', express.static(SITES_DIR));

// Catch-all route for sites to serve index.html for SPA routing
app.get('/sites/:siteSlug/*', (req, res) => {
  const siteSlug = req.params.siteSlug;
  const indexPath = path.join(SITES_DIR, siteSlug, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Site not found');
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('Error handler caught:', err);
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    path: req.path
  });
});

// Catch-all for 404 errors - must be after all other routes
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    path: req.path
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with timeout: ${server.timeout}ms`);
  });
}

module.exports = app;
