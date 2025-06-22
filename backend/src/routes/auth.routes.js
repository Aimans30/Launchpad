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
router.get('/user', authController.getCurrentUser); // Endpoint used by frontend
router.get('/me', authController.getCurrentUser); // Keep for backward compatibility
router.get('/verify-token', authController.verifyToken);

module.exports = router;
