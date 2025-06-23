const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debug.controller');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Debug routes
router.get('/github-token', debugController.checkGithubToken);
router.post('/github-token', debugController.setGithubToken);

module.exports = router;
