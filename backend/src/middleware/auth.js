const admin = require('firebase-admin');

/**
 * Authentication middleware
 * Verifies Firebase token and attaches user to request
 */
exports.authMiddleware = async (req, res, next) => {
  try {
    console.log('Auth middleware - checking authorization');
    console.log('Request path:', req.path);
    console.log('Headers:', Object.keys(req.headers).join(', '));
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header found');
      return res.status(401).json({ error: 'No token provided' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('Invalid authorization format, expected Bearer token');
      return res.status(401).json({ error: 'Invalid authorization format' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('Empty token provided');
      return res.status(401).json({ error: 'Empty token provided' });
    }
    
    console.log('Verifying Firebase token...');
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError.message);
      return res.status(401).json({ 
        error: 'Invalid token', 
        details: firebaseError.message,
        code: firebaseError.code || 'auth/invalid-token'
      });
    }
    
    if (!decodedToken || !decodedToken.uid) {
      console.error('Token verified but no UID found');
      return res.status(401).json({ error: 'Invalid user token' });
    }
    
    // Log the decoded token for debugging
    console.log('Decoded token:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      provider: decodedToken.firebase?.sign_in_provider
    });
    
    // Attach user ID to request
    req.user = {
      firebase_uid: decodedToken.uid, // This should match the auth.uid() in Supabase
      id: decodedToken.uid, // Also provide as id for compatibility
      email: decodedToken.email,
      provider: decodedToken.firebase?.sign_in_provider
    };
    
    console.log('Authentication successful for user:', req.user.firebase_uid);
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
      details: error.message
    });
  }
};
