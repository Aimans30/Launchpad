const express = require('express');
const router = express.Router();
const deploymentController = require('../controllers/deployment.controller');
const { validateDeployment } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

// TEMPORARY: Authentication disabled for testing
// router.use(authMiddleware);

// Deployment routes
router.post('/', validateDeployment, deploymentController.createDeployment);
router.get('/', deploymentController.getAllDeployments);
router.get('/all', deploymentController.getAllSiteDeployments);
router.get('/user', deploymentController.getUserDeployments);
router.get('/:id', deploymentController.getDeploymentById);
router.put('/:id', validateDeployment, deploymentController.updateDeployment);
router.delete('/:id', deploymentController.deleteDeployment);
router.post('/:id/rebuild', deploymentController.rebuildDeployment);
router.get('/:id/logs', deploymentController.getDeploymentLogs);
router.get('/:id/status', deploymentController.getDeploymentStatus);

// New routes for deployment files
router.get('/:id/files', deploymentController.getDeploymentFiles);
router.get('/:id/files/:filePath(*)', deploymentController.getFileContent);

module.exports = router;
