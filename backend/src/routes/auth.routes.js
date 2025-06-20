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
router.get('/me', authController.getCurrentUser);
router.get('/verify-token', authController.verifyToken);

module.exports = router;
