const Joi = require('joi');

/**
 * Validate authentication request
 */
exports.validateAuth = (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  next();
};

/**
 * Validate project creation/update request
 */
exports.validateProject = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().min(3).max(100),
    repositoryUrl: Joi.string().required().uri(),
    framework: Joi.string().required(),
    subdomain: Joi.string().required().alphanum().min(3).max(63).lowercase(),
    environmentVariables: Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.string().required(),
        environment: Joi.string().valid('development', 'production', 'preview').default('production'),
      })
    ),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  next();
};

/**
 * Validate deployment creation/update request
 */
exports.validateDeployment = (req, res, next) => {
  const schema = Joi.object({
    projectId: Joi.string().required(),
    branch: Joi.string().default('main'),
    commitSha: Joi.string(),
    status: Joi.string().valid('queued', 'processing', 'success', 'failed'),
    deploymentUrl: Joi.string().uri(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  next();
};
