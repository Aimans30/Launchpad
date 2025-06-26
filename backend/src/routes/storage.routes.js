const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/storage');
const { authMiddleware } = require('../middleware/auth');

/**
 * Route to serve static files from Supabase Storage
 * This allows users to view their uploaded sites
 */
router.get('/sites/:slug/*', async (req, res) => {
  try {
    const { slug } = req.params;
    // Get the file path from the URL (everything after /sites/slug/)
    const filePath = req.params[0] || 'index.html';
    const storagePath = `${slug}/${filePath}`;
    
    console.log(`Serving file from storage: sites/${storagePath}`);
    
    // Get the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from('sites')
      .download(storagePath);
    
    if (error) {
      console.error('Error fetching file from storage:', error);
      
      // If file not found, try to serve index.html for SPA routing
      if (error.statusCode === 404 && !filePath.includes('.')) {
        const { data: indexData, error: indexError } = await supabase.storage
          .from('sites')
          .download(`${slug}/index.html`);
          
        if (indexError) {
          return res.status(404).send('File not found');
        }
        
        // Set appropriate content type for HTML
        res.setHeader('Content-Type', 'text/html');
        return res.send(Buffer.from(await indexData.arrayBuffer()));
      }
      
      return res.status(404).send('File not found');
    }
    
    // Set appropriate content type based on file extension
    const contentType = getContentType(filePath);
    res.setHeader('Content-Type', contentType);
    
    // Send the file
    res.send(Buffer.from(await data.arrayBuffer()));
  } catch (error) {
    console.error('Error serving file from storage:', error);
    res.status(500).send('Server error');
  }
});

/**
 * Route to get site information
 * Requires authentication
 */
router.get('/site-info/:slug', authMiddleware, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.firebase_uid || req.user.id;
    
    // Get site information from database
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('slug', slug)
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
    console.error('Error getting site info:', error);
    res.status(500).json({ error: 'Failed to get site info' });
  }
});

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const contentTypes = {
    'html': 'text/html',
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
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = router;
