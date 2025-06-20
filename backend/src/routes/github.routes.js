const express = require('express');
const router = express.Router();
const githubController = require('../controllers/github.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.verifyToken);

// Get repositories for the authenticated user
router.get('/repositories', githubController.getRepositories);

// Get branches for a specific repository
router.get('/repositories/:owner/:repo/branches', githubController.getRepositoryBranches);

// Validate repository access
router.post('/validate-repository', githubController.validateRepository);

module.exports = router;
