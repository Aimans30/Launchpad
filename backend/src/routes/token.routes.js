const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/token.controller');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Token routes
router.post('/github', tokenController.setGithubToken);
router.get('/github/status', tokenController.getTokenStatus);

module.exports = router;
