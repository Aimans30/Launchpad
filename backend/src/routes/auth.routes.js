const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateAuth } = require('../middleware/validate');

// GitHub OAuth routes
router.get('/github', authController.githubLogin);
router.get('/github/callback', authController.githubCallback);

// User authentication routes
router.post('/login', validateAuth, authController.login);
router.post('/logout', authController.logout);

// User data endpoints - support both GET and POST for flexibility
router.get('/user', authController.getCurrentUser); // Get user data from token
router.post('/user', authController.getCurrentUser); // Allow updating user data
router.get('/me', authController.getCurrentUser); // Keep for backward compatibility

// Token verification
router.get('/verify-token', authController.verifyToken);

module.exports = router;
