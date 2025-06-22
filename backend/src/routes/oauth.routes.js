const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauth.controller');

// GitHub OAuth routes
router.get('/github', oauthController.initiateGitHubAuth);
router.get('/github/callback', oauthController.handleGitHubCallback);

module.exports = router;
