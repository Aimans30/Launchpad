const express = require('express');
const router = express.Router();
const githubAuthController = require('../controllers/github-auth.controller');

// GitHub auth routes
router.get('/store-token', githubAuthController.storeGithubToken);

module.exports = router;
