const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { validateProject } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Project routes
router.post('/', validateProject, projectController.createProject);
router.get('/', projectController.getAllProjects);
router.get('/user', projectController.getUserProjects);
router.get('/:id', projectController.getProjectById);
router.put('/:id', validateProject, projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.get('/:id/deployments', projectController.getProjectDeployments);
router.post('/:id/environments', projectController.createEnvironment);
router.get('/:id/environments', projectController.getEnvironments);

module.exports = router;
