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

// Set Origin-Agent-Cluster header globally for all routes to avoid browser warnings
app.use((req, res, next) => {
  res.setHeader('Origin-Agent-Cluster', '?0');
  next();
});

// Middleware to add permissive CSP headers for site and API routes
// Must be defined BEFORE the routes that need these headers
app.use([
  '/api/sites/:siteId/raw',
  '/api/sites/:siteId/proxy',
  '/api/sites/:siteId/proxy/*'
], (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data: blob:;"
  );
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Origin-Agent-Cluster', '?0');
  next();
});

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
// CORS setup - allow all origins for this internal tool
app.use(cors({
  origin: '*',
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
app.use(
  helmet({
    contentSecurityPolicy: false // disable default CSP
  })
);

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

// Serve static files from the public directory
app.use('/public', express.static(path.join(__dirname, '../public')));

// Create a full site proxy to handle entire website content
const axios = require('axios');
const mime = require('mime-types');

// Create a full proxy for all site files
app.get('/api/sites/:siteId/proxy/*', async (req, res) => {
  console.log('[PROXY] Request for:', req.params);

  try {
    const { siteId } = req.params;
    const bucketName = 'sites';

    // Extract the file path from the URL (everything after /proxy/)
    let filePath = req.params[0] || 'index.html';

    // Filter out any query parameters
    filePath = filePath.split('?')[0];

    console.log('[PROXY] File path:', filePath);

    // Get Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    );

    // First, check if the file exists by trying to download it
    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucketName)
      .download(`${siteId}/${filePath}`);

    if (fileError || !fileData) {
      // If file not found, check if this is a React app route and serve index.html
      if (!filePath.includes('.')) {
        console.log('[PROXY] Looks like a route in a SPA, serving index.html');
        const { data: indexData, error: indexError } = await supabase.storage
          .from(bucketName)
          .download(`${siteId}/index.html`);

        if (indexError || !indexData) {
          return res.status(404).send('Site index.html not found');
        }

        // Convert Blob to string
        const indexContent = await indexData.text();

        // Set content type header for HTML
        res.setHeader('Content-Type', 'text/html');
        return res.send(indexContent);
      }

      console.error(`[PROXY] File not found: ${siteId}/${filePath}`, fileError);
      return res.status(404).send(`File not found: ${filePath}`);
    }

    // Determine the appropriate content type based on file extension
    const ext = filePath.split('.').pop().toLowerCase();

    // Force specific MIME types for web files to ensure proper rendering
    const mimeTypes = {
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
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject'
    };

    const contentType = mimeTypes[ext] || mime.lookup(filePath) || 'application/octet-stream';
    console.log('[PROXY] Content type for', filePath, ':', contentType);

    // Set content type header
    res.setHeader('Content-Type', contentType);

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // For text-based content, convert Blob to string
    if (['text/html', 'text/css', 'application/javascript', 'application/json', 'text/plain'].includes(contentType)) {
      const textContent = await fileData.text();
      return res.send(textContent);
    } else {
      // For binary content, convert Blob to Buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    }
  } catch (error) {
    console.error('[PROXY] Error:', error);
    return res.status(500).send(`Error: ${error.message}`);
  }
});

// Full static site viewer - using iframe approach for reliable rendering
app.get('/api/sites/:siteId/view', async (req, res) => {
  console.log('[DIRECT] Site view accessed for site:', req.params.siteId);

  try {
    const { siteId } = req.params;
    const bucketName = 'sites';

    // Get Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    );

    // First check if site exists
    const { data: listData, error: listError } = await supabase.storage
      .from(bucketName)
      .list(siteId, { limit: 1 });

    if (listError || !listData || listData.length === 0) {
      return res.status(404).send(`Site with ID ${siteId} not found`);
    }

    // Send an appropriate HTML page with our self-contained viewer
    res.setHeader('Content-Type', 'text/html');

    // Create a self-contained viewer that doesn't rely on external CSS/JS files
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Site Preview - ${siteId}</title>
        <style>
          body, html { margin: 0; padding: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .site-header {
            background: #f8f9fa; 
            padding: 10px 20px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .site-header h3 { margin: 0; }
          .site-header a { text-decoration: none; color: #0070f3; margin-left: 10px; }
          .content-container { height: calc(100vh - 58px); width: 100%; overflow: hidden; position: relative; }
          iframe { border: none; width: 100%; height: 100%; min-height: 600px; }
          .error-message { padding: 20px; text-align: center; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 20px; }
          .loading-indicator { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
          .loading-indicator:after { content: ''; display: block; width: 40px; height: 40px; margin: 10px auto; border-radius: 50%; border: 5px solid #f3f3f3; border-top: 5px solid #0070f3; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="site-header">
          <h3>Preview: ${siteId}</h3>
          <div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/sites">Back to Sites</a>
            <a href="/api/sites/${siteId}/files" target="_blank">View Files</a>
          </div>
        </div>
        <div class="content-container">
          <div class="loading-indicator">Loading site preview...</div>
          <iframe src="/api/sites/${siteId}/raw" id="siteFrame" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-orientation-lock"></iframe>
        </div>
        <script>
          // Monitor for iframe load events
          const iframe = document.getElementById('siteFrame');
          const loadingIndicator = document.querySelector('.loading-indicator');
          
          iframe.onload = function() {
            // Hide loading indicator when frame loads
            loadingIndicator.style.display = 'none';
          };
          
          iframe.onerror = function() {
            // Show error message if frame fails to load
            loadingIndicator.innerHTML = '<div class="error-message"><h3>Error Loading Site</h3><p>Could not load the site preview. The site may not have been properly uploaded or the index.html file is missing.</p></div>';
          };
        </script>
      </body>
      </html>
    `;

    // Send the self-contained viewer
    res.send(fullHtml);
  } catch (error) {
    console.error('[DIRECT] Error in site view:', error);
    return res.status(500).send(`Error: ${error.message}`);
  }
});

// Raw site endpoint - serves the site HTML directly with no header
app.get('/api/sites/:siteId/raw', async (req, res) => {
  console.log('[RAW] Raw site access for site:', req.params.siteId);

  try {
    let { siteId } = req.params;
    const bucketName = 'sites';
    
    // Format siteId correctly (if it doesn't have 'site-' prefix, add it)
    if (!siteId.startsWith('site-')) {
      siteId = `site-${siteId}`;
    }

    // Get Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    );

    // First check if site exists
    const { data: listData, error: listError } = await supabase.storage
      .from(bucketName)
      .list(siteId);

    if (listError || !listData || listData.length === 0) {
      return res.status(404).send(`<html><body><h1>Site Not Found</h1><p>Site with ID ${siteId} not found</p></body></html>`);
    }

    // Check for index.html
    const hasIndex = listData.some(item => item.name === 'index.html');
    if (!hasIndex) {
      return res.status(404).send(`<html><body><h1>Missing index.html</h1><p>Site ${siteId} does not have an index.html file</p></body></html>`);
    }

    // Download the index.html file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(`${siteId}/index.html`);

    if (error || !data) {
      return res.status(404).send(`<html><body><h1>Error</h1><p>Could not download index.html</p></body></html>`);
    }

    // Read the HTML content
    const htmlContent = await data.text();

    // Set content type to HTML
    res.setHeader('Content-Type', 'text/html');
    
    const isReactApp = htmlContent.includes('manifest.json') ||
      htmlContent.includes('/static/js/') ||
      htmlContent.includes('/static/css/');

    // Get site structure to verify what we have
    const { data: siteFiles } = await supabase.storage
      .from(bucketName)
      .list(siteId);

    // Log what files we have in storage
    console.log('[RAW] Files in storage for site', siteId, ':', siteFiles?.map(f => f.name).join(', '));

    // Check for static folder
    let hasStaticFolder = false;
    const staticFolderCheck = await supabase.storage
      .from(bucketName)
      .list(`${siteId}/static`, { limit: 1 });

    if (staticFolderCheck.data && staticFolderCheck.data.length > 0) {
      hasStaticFolder = true;
    }

    console.log('[RAW] Has static folder:', hasStaticFolder);

    // If we have a static folder, check its structure
    if (hasStaticFolder) {
      const staticFolderContents = await supabase.storage
        .from(bucketName)
        .list(`${siteId}/static`);

      console.log('[RAW] Static folder contents:', staticFolderContents.data?.map(f => f.name).join(', '));
    }

    let modifiedHtml = htmlContent;

    if (isReactApp) {
      console.log('[RAW] Detected React app, modifying URLs');
      
      // Add BASE element to ensure all relative URLs are resolved correctly
      if (!modifiedHtml.includes('<base ')) {
        modifiedHtml = modifiedHtml.replace('<head>', '<head>\n<base href="/api/sites/' + siteId + '/proxy/" />');
      }
      
      // Add script loading attributes to help with execution
      modifiedHtml = modifiedHtml.replace(/<script/g, '<script defer crossorigin="anonymous"');
      
      // Fix paths to static/css and static/js assets - these are actually in the root
      // Map /static/css/main.hash.css to just /main.hash.css through our proxy
      modifiedHtml = modifiedHtml.replace(/src=[\"\']\/static\/(?:js|css)\/([^\"']+)[\"']/g, 
        'src="/api/sites/' + siteId + '/proxy/$1"');
      modifiedHtml = modifiedHtml.replace(/href=[\"\']\/static\/(?:js|css)\/([^\"']+)[\"']/g, 
        'href="/api/sites/' + siteId + '/proxy/$1"');
      
      // Fix absolute paths to root assets
      modifiedHtml = modifiedHtml.replace(/src=[\"\']\/(main\.[^\"\'\/]+)[\"\']/g, 
        'src="/api/sites/' + siteId + '/proxy/$1"');
      modifiedHtml = modifiedHtml.replace(/href=[\"\']\/(main\.[^\"\'\/]+)[\"\']/g, 
        'href="/api/sites/' + siteId + '/proxy/$1"');
      modifiedHtml = modifiedHtml.replace(/src=[\"\']\/(\d+\.[^\"\'\/]+\.chunk\.js)[\"\']/g, 
        'src="/api/sites/' + siteId + '/proxy/$1"');
      
      // Fix relative paths (no leading slash)
      modifiedHtml = modifiedHtml.replace(/src=[\"\'](?!\/|http|\/api)(main\.[^\"\'\/]+)[\"\']/g, 
        'src="/api/sites/' + siteId + '/proxy/$1"');
      modifiedHtml = modifiedHtml.replace(/href=[\"\'](?!\/|http|\/api)(main\.[^\"\'\/]+)[\"\']/g, 
        'href="/api/sites/' + siteId + '/proxy/$1"');
      modifiedHtml = modifiedHtml.replace(/src=[\"\'](?!\/|http|\/api)(\d+\.[^\"\'\/]+\.chunk\.js)[\"\']/g, 
        'src="/api/sites/' + siteId + '/proxy/$1"');
      
      // Special handling for manifest.json and favicon.ico
      modifiedHtml = modifiedHtml.replace(/href=[\"\']\/(manifest\.json)[\"\']/g, 
        'href="/api/sites/' + siteId + '/proxy/$1"');
      modifiedHtml = modifiedHtml.replace(/href=[\"\']\/(favicon\.ico)[\"\']/g, 
        'href="/api/sites/' + siteId + '/proxy/$1"');
      
      // Add debugging indicator for easier troubleshooting
      modifiedHtml = modifiedHtml.replace('</head>', 
        '<script>console.log("[LAUNCHPAD VIEWER] Site loaded through proxy");</script></head>');
      
      console.log('[RAW] Modified React app asset paths');
    } else {
      // Check if it's a Vite app
      const isViteApp = htmlContent.includes('/assets/index-') || 
        htmlContent.match(/\/assets\/[^\/]+\.[a-zA-Z0-9]+\-[a-zA-Z0-9]+\.(js|css)/);

      if (isViteApp) {
        console.log('[RAW] Detected Vite app, modifying URLs');
        
        // Add BASE element to ensure all relative URLs are resolved correctly
        if (!modifiedHtml.includes('<base ')) {
          modifiedHtml = modifiedHtml.replace('<head>', `<head>\n<base href="/api/sites/${siteId}/proxy/" />`);
        }
        
        // For Vite builds, we need a more comprehensive approach to handle all asset references
        
        // Get the list of actual files in the bucket to use for replacement
        const fileList = siteFiles.map(f => f.name);
        console.log('[RAW] Available files for replacement:', fileList);
        
        // Create a map of file extensions to actual files
        const fileMap = {};
        fileList.forEach(file => {
          const ext = file.split('.').pop().toLowerCase();
          if (!fileMap[ext]) {
            fileMap[ext] = [];
          }
          fileMap[ext].push(file);
        });
        
        console.log('[RAW] File map by extension:', fileMap);
        
        // DIRECT APPROACH: Replace asset references with direct links to the actual files
        // This is the most reliable approach for Vite builds
        
        // For CSS files
        if (fileMap['css'] && fileMap['css'].length > 0) {
          const cssFile = fileMap['css'][0]; // Use the first CSS file
          console.log(`[RAW] Using CSS file: ${cssFile}`);
          
          // Replace all CSS references (both absolute and relative paths)
          modifiedHtml = modifiedHtml.replace(/href=[\"\'](\/?assets\/[^\"']+\.css)[\"']/g, 
            `href="/api/sites/${siteId}/proxy/${cssFile}"`);
          modifiedHtml = modifiedHtml.replace(/href=[\"\']\/([^\"'\/]+\.css)[\"']/g, 
            `href="/api/sites/${siteId}/proxy/${cssFile}"`);
        }
        
        // For JS files
        if (fileMap['js'] && fileMap['js'].length > 0) {
          const jsFile = fileMap['js'][0]; // Use the first JS file
          console.log(`[RAW] Using JS file: ${jsFile}`);
          
          // Replace all JS references (both absolute and relative paths)
          modifiedHtml = modifiedHtml.replace(/src=[\"\'](\/?assets\/[^\"']+\.js)[\"']/g, 
            `src="/api/sites/${siteId}/proxy/${jsFile}"`);
          modifiedHtml = modifiedHtml.replace(/src=[\"\']\/([^\"'\/]+\.js)[\"']/g, 
            `src="/api/sites/${siteId}/proxy/${jsFile}"`);
        }
        
        // For images and other assets
        const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
        imgExts.forEach(ext => {
          if (fileMap[ext] && fileMap[ext].length > 0) {
            fileMap[ext].forEach(imgFile => {
              // Extract the base name without extension
              const baseName = imgFile.split('.')[0];
              const baseNameWithoutHash = baseName.split('-')[0];
              
              console.log(`[RAW] Found image: ${imgFile}, basename: ${baseName}, clean name: ${baseNameWithoutHash}`);
              
              // Replace references to this specific image
              const imgRegex = new RegExp(`src=[\"\'](\/?assets\/)?${baseNameWithoutHash}[^\"']*\.${ext}[\"']`, 'g');
              modifiedHtml = modifiedHtml.replace(imgRegex, `src="/api/sites/${siteId}/proxy/${imgFile}"`);
              
              // Also handle absolute paths
              const absImgRegex = new RegExp(`src=[\"\']\/[^\"'\/]*${baseNameWithoutHash}[^\"']*\.${ext}[\"']`, 'g');
              modifiedHtml = modifiedHtml.replace(absImgRegex, `src="/api/sites/${siteId}/proxy/${imgFile}"`);
            });
            
            // Add a special style tag to help with image references in CSS
            const imageStyles = fileMap[ext].map(img => {
              const baseName = img.split('.')[0];
              const baseNameWithoutHash = baseName.split('-')[0];
              return `.${baseNameWithoutHash}, #${baseNameWithoutHash}, [src*="${baseNameWithoutHash}"] { background-image: url("/api/sites/${siteId}/proxy/${img}") !important; }\n`;
            }).join('');
            
            modifiedHtml = modifiedHtml.replace('</head>', `<style>/* Image path fixes */\n${imageStyles}</style>\n</head>`);
          }
        });
        
        // Add a script to help debug and fix any remaining asset references
        const debugScript = `
        <script>
          console.log('[LAUNCHPAD VIEWER] Vite site loaded through proxy');
          // Fix any remaining asset references dynamically
          document.addEventListener('DOMContentLoaded', function() {
            // Fix image sources that might be broken
            document.querySelectorAll('img[src^="/assets/"]').forEach(img => {
              const origSrc = img.getAttribute('src');
              const fileName = origSrc.split('/').pop();
              img.setAttribute('src', '/api/sites/${siteId}/proxy/' + fileName);
              console.log('Fixed image path:', origSrc, '->', '/api/sites/${siteId}/proxy/' + fileName);
            });
            
            // Fix background images in inline styles
            document.querySelectorAll('[style*="background"]').forEach(el => {
              const style = el.getAttribute('style');
              if (style && style.includes('/assets/')) {
                const newStyle = style.replace(/\/assets\/([^\)]+)/g, '/api/sites/${siteId}/proxy/$1');
                el.setAttribute('style', newStyle);
                console.log('Fixed background style:', style, '->', newStyle);
              }
            });
          });
        </script>
        `;
        
        modifiedHtml = modifiedHtml.replace('</head>', `${debugScript}\n</head>`);
        
        // Also handle direct references to the hashed files in the root
        modifiedHtml = modifiedHtml.replace(/src=[\"\']\/([^\"'\/]+\-[a-zA-Z0-9]+\.(js|css))[\"']/g, 
          `src="/api/sites/${siteId}/proxy/$1"`);
        modifiedHtml = modifiedHtml.replace(/href=[\"\']\/([^\"'\/]+\-[a-zA-Z0-9]+\.(js|css))[\"']/g, 
          `href="/api/sites/${siteId}/proxy/$1"`);
          
          
        // Add debugging indicator
        modifiedHtml = modifiedHtml.replace('</head>', 
          '<script>console.log("[LAUNCHPAD VIEWER] Vite site loaded through proxy");</script></head>');
          
        console.log('[RAW] Modified Vite app asset paths');
      } else {
        // For other sites, add a base tag
        modifiedHtml = modifiedHtml.replace('<head>', `<head>\n<base href="/api/sites/${siteId}/proxy/" />`);
      }
    }

    // Send the HTML content
    return res.send(modifiedHtml);
  } catch (error) {
    console.error('[RAW] Error serving raw site:', error);
    return res.status(500).send(`<html><body><h1>Error</h1><p>${error.message}</p></body></html>`);
  }
});

// Proxy endpoint to serve site assets with correct MIME types
app.get('/api/sites/:siteId/proxy/*', async (req, res) => {
  let { siteId } = req.params;
  // The 0 at the end ensures we get everything after '/proxy/' including additional slashes
  // Clean up the asset path by removing any leading slashes
  let assetPath = req.params[0] || '';
  // Remove leading slash if present
  if (assetPath.startsWith('/')) {
    assetPath = assetPath.substring(1);
  }
  
  // Format siteId correctly (if it doesn't have 'site-' prefix, add it)
  if (!siteId.startsWith('site-')) {
    siteId = `site-${siteId}`;
  }

  console.log(`[PROXY] Serving asset for site ${siteId}: ${assetPath}`);

  try {
    const bucketName = 'sites';
    const filePath = `${siteId}/${assetPath}`;

    // Get Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    );

    // Return directly for OPTIONS requests (preflight)
    // Headers like CSP and CORS are set by middleware
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Check if this is a request for a file or directory
    // If it has a file extension, treat as file; otherwise could be SPA route
    const hasExtension = assetPath.includes('.') && !assetPath.endsWith('/');

    if (hasExtension) {
      // This is a file request, try to download it directly
      console.log(`[PROXY] Fetching file: ${filePath}`);

      // Determine content type based on file extension
      const mime = require('mime-types');

      // Force correct MIME types for key web assets regardless of what mime-types says
      let contentType;
      if (assetPath.endsWith('.js')) {
        contentType = 'application/javascript';
      } else if (assetPath.endsWith('.css')) {
        contentType = 'text/css';
      } else if (assetPath.endsWith('.json')) {
        contentType = 'application/json';
      } else if (assetPath.endsWith('.html') || assetPath.endsWith('.htm')) {
        contentType = 'text/html';
      } else if (assetPath.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      } else if (assetPath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (assetPath.endsWith('.ico')) {
        contentType = 'image/x-icon';
      } else {
        contentType = mime.lookup(assetPath) || 'application/octet-stream';
      }

      console.log(`[PROXY] Content type determined: ${contentType}`);
      res.setHeader('Content-Type', contentType);

      // Now check if the file exists and serve it
      try {
        // Get a list of all files in the site bucket to help with matching
        const { data: siteFiles } = await supabase.storage
          .from(bucketName)
          .list(siteId);
          
        const availableFiles = siteFiles?.map(f => f.name) || [];
        console.log(`[PROXY] Files available in bucket for ${siteId}:`, availableFiles.join(', '));
        
        // Create a map of file extensions to actual files
        const fileMap = {};
        availableFiles.forEach(file => {
          const ext = file.split('.').pop().toLowerCase();
          if (!fileMap[ext]) {
            fileMap[ext] = [];
          }
          fileMap[ext].push(file);
        });
        
        // Extract the file extension from the requested path
        const requestedExt = assetPath.split('.').pop().toLowerCase();
        console.log(`[PROXY] Requested file extension: ${requestedExt}`);
        
        // Extract just the filename without path
        const filenameWithoutPath = assetPath.split('/').pop();
        console.log(`[PROXY] Requested filename: ${filenameWithoutPath}`);
        
        // Try multiple paths in order of likelihood
        const pathsToTry = [
          // 1. Exact path as requested
          `${siteId}/${assetPath}`,
          
          // 2. Just the filename in the root (for Vite assets)
          `${siteId}/${filenameWithoutPath}`,
          
          // 3. If it's an assets/ path, try without the assets/ prefix
          ...(assetPath.startsWith('assets/') ? [`${siteId}/${assetPath.substring('assets/'.length)}`] : []),
          
          // 4. Try any file with the same extension (last resort)
          ...(fileMap[requestedExt] ? fileMap[requestedExt].map(file => `${siteId}/${file}`) : [])
        ];
        
        console.log(`[PROXY] Will try these paths in order:`, pathsToTry);
        
        // Try each path in order until we find the file
        let data = null;
        let error = null;
        let actualFilePath = null;
        
        for (const path of pathsToTry) {
          console.log(`[PROXY] Trying path: ${path}`);
          const result = await supabase.storage
            .from(bucketName)
            .download(path);
            
          if (!result.error && result.data) {
            data = result.data;
            error = null;
            actualFilePath = path;
            console.log(`[PROXY] Found file at: ${path}`);
            break;
          }
        }
        
        // If we've tried all paths and still haven't found the file
        if (!data || error) {
          console.log(`[PROXY] File not found after trying all paths: ${assetPath}`);
          console.log(`[PROXY] Tried paths:`, pathsToTry);
          
          // Last resort: try to find any file with the same extension
          const fileExt = assetPath.split('.').pop().toLowerCase();
          const { data: allFiles } = await supabase.storage
            .from(bucketName)
            .list(siteId);
            
          const matchingFiles = allFiles?.filter(f => f.name.endsWith(`.${fileExt}`)) || [];
          
          if (matchingFiles.length > 0) {
            // Use the first matching file by extension
            const matchedFile = matchingFiles[0].name;
            const matchedPath = `${siteId}/${matchedFile}`;
            console.log(`[PROXY] Last resort: trying file with matching extension: ${matchedPath}`);
            
            const lastResult = await supabase.storage
              .from(bucketName)
              .download(matchedPath);
              
            if (!lastResult.error && lastResult.data) {
              data = lastResult.data;
              error = null;
              actualFilePath = matchedPath;
              console.log(`[PROXY] Found file with matching extension: ${matchedPath}`);
            } else {
              return res.status(404).send(`File not found: ${assetPath}`);
            }
          } else {
            return res.status(404).send(`File not found: ${assetPath}`);
          }
        }

        // If not found, try different options based on the file type and structure
        if (error || !data) {
          // Check if this might be a Vite asset with a special path
          if (isViteAsset || assetPath.match(/index-[a-zA-Z0-9]+\.(js|css)$/)) {
            // Try looking in the dist/ directory
            const distPath = `${siteId}/dist/${assetPath}`;
            triedPaths.push(distPath);
            console.log(`[PROXY] Checking for Vite asset in dist: ${distPath}`);
            
            const distResult = await supabase.storage
              .from(bucketName)
              .download(distPath);
              
            if (!distResult.error && distResult.data) {
              data = distResult.data;
              error = null;
              actualFilePath = distPath;
              console.log(`[PROXY] Found in dist directory: ${distPath}`);
            } else {
              // Try looking for the asset in dist/assets/
              const distAssetsPath = `${siteId}/dist/assets/${assetPath.split('/').pop()}`;
              triedPaths.push(distAssetsPath);
              console.log(`[PROXY] Checking in dist/assets: ${distAssetsPath}`);
              
              const assetsResult = await supabase.storage
                .from(bucketName)
                .download(distAssetsPath);
                
              if (!assetsResult.error && assetsResult.data) {
                data = assetsResult.data;
                error = null;
                actualFilePath = distAssetsPath;
                console.log(`[PROXY] Found in dist/assets directory: ${distAssetsPath}`);
              }
            }
          }
          
          // Standard React/CRA fallback - try just the filename from the root
          if ((error || !data) && assetPath.includes('/')) {
            const filename = assetPath.split('/').pop();
            const rootFilePath = `${siteId}/${filename}`;
            triedPaths.push(rootFilePath);
            console.log(`[PROXY] Asset not found at ${actualFilePath}, trying root: ${rootFilePath}`);
            const rootResult = await supabase.storage
              .from(bucketName)
              .download(rootFilePath);
            if (!rootResult.error && rootResult.data) {
              data = rootResult.data;
              error = null;
              actualFilePath = rootFilePath;
              console.log(`[PROXY] Found in root directory: ${rootFilePath}`);
            }
          }
        }

        // Log all attempted paths
        console.log(`[PROXY] Asset request for: ${assetPath}`);
        console.log(`[PROXY] Tried paths:`, triedPaths.join(' | '));
        if (error) {
          // List all available files for debugging
          const { data: availableFiles } = await supabase.storage
            .from(bucketName)
            .list(siteId);
          const availableNames = availableFiles ? availableFiles.map(f => f.name).join(', ') : 'none';
          console.error(`[PROXY] Download error:`, error);
          console.error(`[PROXY] Available files in ${siteId}: ${availableNames}`);
          if (/\.(js|css|json|xml|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i.test(assetPath)) {
            return res.status(404).end(); // Empty response for assets to prevent MIME errors
          } else {
            return res.status(404).send(`File not found: ${assetPath}`);
          }
        }

        if (!data) {
          if (/\.(js|css|json|xml|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i.test(assetPath)) {
            return res.status(404).end();
          } else {
            return res.status(404).send(`Empty file: ${assetPath}`);
          }
        }

        // Determine if we should return as text or binary
        const isTextBased = contentType.startsWith('text/') ||
          contentType === 'application/javascript' ||
          contentType === 'application/json' ||
          contentType.includes('xml');

        // Serve file with proper content type
        if (isTextBased) {
          const textContent = await data.text();
          return res.send(textContent);
        } else {
          // Binary file
          const buffer = await data.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }

        // No need to redeclare isTextBased again below; just use the existing logic above.

      } catch (error) {
        console.error(`[PROXY] Error fetching ${filePath}:`, error);
        if (/\.(js|css|json|xml)$/i.test(assetPath)) {
          return res.status(404).end();
        } else {
          return res.status(500).send(`Server error: ${error.message}`);
        }
      }
    } else {
      // This is likely an SPA route - serve index.html if no extension
      console.log(`[PROXY] Serving SPA route - fallback to index.html for: ${assetPath}`);

      // Serve main index.html for SPA routes
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .download(`${siteId}/index.html`);

        if (error || !data) {
          return res.status(404).send(`Site not found or index.html missing for: ${siteId}`);
        }

        const htmlContent = await data.text();
        res.setHeader('Content-Type', 'text/html');
        return res.send(htmlContent);
      } catch (error) {
        console.error(`[PROXY] Error serving SPA fallback:`, error);
        return res.status(500).send(`Server error: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`[PROXY] Global error:`, error);
    return res.status(500).send(`Server error: ${error.message}`);
  }
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
