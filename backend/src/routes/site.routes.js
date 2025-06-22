const express = require('express');
const router = express.Router();
const siteController = require('../controllers/site.controller');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 100 // Max 100 files
  }
});

// All routes require authentication
router.use(authMiddleware);

// Site routes
router.post('/upload', zipUpload.single('zipFile'), siteController.uploadSite);
router.post('/upload-folder', folderUpload.array('files'), siteController.uploadFolder);
router.post('/', siteController.createSite);
router.get('/', siteController.getAllSites);
router.get('/user', siteController.getUserSites);
router.get('/:id', siteController.getSiteById);
router.put('/:id', siteController.updateSite);
router.delete('/:id', siteController.deleteSite);

module.exports = router;
