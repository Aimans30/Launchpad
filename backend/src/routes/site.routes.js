const express = require('express');
const router = express.Router();
const siteController = require('../controllers/site.controller');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Debug: Log available controller methods
console.log('Site controller methods:', Object.keys(siteController));

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

const zipUpload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const folderUpload = multer({
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 500, // Max 500 files
    fieldSize: 50 * 1024 * 1024 // 50MB field size limit
  }
});

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`[SITE ROUTES] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Request files:', req.files ? 'Files present' : 'No files');
  next();
});

// Test route to verify API is working (no auth required)
router.get('/test', (req, res) => {
  console.log('Test route accessed');
  return res.status(200).json({ message: 'API is working' });
});

// IMPORTANT: Upload folder route - NO AUTH REQUIRED
router.post('/upload-folder', folderUpload.array('files'), (req, res) => {
  console.log('Upload folder route accessed - NO AUTH');
  console.log('Files received:', req.files ? req.files.length : 0);
  console.log('Request body:', req.body);
  
  try {
    const files = req.files;
    const { siteName, siteId } = req.body;
    
    console.log(`Received folder upload request with ${files ? files.length : 0} files`);
    console.log(`Site name: ${siteName}, Site ID: ${siteId}`);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // For now, just return success to test if the route is working
    return res.status(200).json({
      success: true,
      message: 'Upload route is working',
      filesReceived: files.length,
      siteName,
      siteId
    });
  } catch (error) {
    console.error('Error in upload-folder route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// TEMPORARY: Authentication disabled for testing
// router.use(authMiddleware);

// Site routes
router.post('/upload', zipUpload.single('zipFile'), siteController.uploadSite);

// Fallback direct implementation for authenticated uploads
router.post('/upload-folder-auth', folderUpload.array('files'), siteController.uploadFolder);
router.post('/', siteController.createSite);
router.get('/', siteController.getAllSites);
router.get('/user', siteController.getUserSites);
// Make sure specific routes come before generic ones with path parameters
router.get('/:siteId/files', siteController.getSiteFiles);
router.get('/:id', siteController.getSiteById);
router.put('/:id', siteController.updateSite);
router.delete('/:id', siteController.deleteSite);

// Deployment and environment variable routes
router.post('/:id/deploy', siteController.deploySite);
router.get('/:id/env', siteController.getSiteEnvVars);
router.post('/:id/env', siteController.setSiteEnvVars);

module.exports = router;
