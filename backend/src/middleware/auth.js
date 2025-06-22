const admin = require('firebase-admin');

/**
 * Authentication middleware
 * Verifies Firebase token and attaches user to request
 */
exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Log the decoded token for debugging
    console.log('Decoded token:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      sub: decodedToken.sub
    });
    
    // Attach user ID to request
    req.user = {
      id: decodedToken.uid, // This should match the auth.uid() in Supabase
      uid: decodedToken.uid, // Also provide as uid for compatibility
      email: decodedToken.email,
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};
