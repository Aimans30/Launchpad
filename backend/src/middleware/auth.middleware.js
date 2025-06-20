const admin = require('firebase-admin');

/**
 * Middleware to verify Firebase auth token
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add user ID to request object
    req.user = {
      id: decodedToken.uid
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
