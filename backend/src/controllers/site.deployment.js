/**
 * Site deployment controller functions
 * These will be imported into the main site controller
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

/**
 * Deploy a site
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deploySite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.firebase_uid || req.user.id;
    
    console.log(`Deploying site ${id} for user ${userId}`);
    
    // Get site details from database
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching site for deployment:', error);
      return res.status(404).json({ error: 'Site not found or access denied' });
    }
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Site is already deployed via Supabase Storage
    // Just need to update the deployment status
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .upsert({
        site_id: id,
        status: 'active',
        deployed_url: site.site_url,
        deployed_at: new Date().toISOString(),
        version: (site.version || 0) + 1
      })
      .select()
      .single();
    
    if (deploymentError) {
      console.error('Error creating deployment record:', deploymentError);
      // Continue anyway since the site is still accessible
    }
    
    return res.status(200).json({
      message: 'Site deployed successfully',
      url: site.site_url,
      deployment: deployment || null
    });
  } catch (error) {
    console.error('Error deploying site:', error);
    return res.status(500).json({ error: 'Failed to deploy site' });
  }
};

/**
 * Get site environment variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSiteEnvVars = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.firebase_uid || req.user.id;
    
    // Check if site exists and belongs to user
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (siteError || !site) {
      return res.status(404).json({ error: 'Site not found or access denied' });
    }
    
    // Get environment variables
    const { data, error } = await supabase
      .from('site_env_vars')
      .select('*')
      .eq('site_id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching site env vars:', error);
      return res.status(500).json({ error: error.message });
    }
    
    // Mask secret values
    const maskedEnvVars = (data || []).map(ev => ({
      ...ev,
      value: ev.is_secret ? '********' : ev.value
    }));
    
    return res.status(200).json({
      envVars: maskedEnvVars
    });
  } catch (error) {
    console.error('Error getting site env vars:', error);
    return res.status(500).json({ error: 'Failed to get environment variables' });
  }
};

/**
 * Set site environment variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const setSiteEnvVars = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.firebase_uid || req.user.id;
    const { envVars } = req.body;
    
    if (!Array.isArray(envVars)) {
      return res.status(400).json({ error: 'envVars must be an array' });
    }
    
    // First check if user owns the site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (siteError || !site) {
      return res.status(404).json({ error: 'Site not found or access denied' });
    }
    
    // Delete existing env vars
    const { error: deleteError } = await supabase
      .from('site_env_vars')
      .delete()
      .eq('site_id', id);
    
    if (deleteError) {
      console.error('Error deleting existing env vars:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }
    
    // Insert new env vars
    if (envVars && envVars.length > 0) {
      const envVarsToInsert = envVars.map(ev => ({
        site_id: id,
        user_id: userId,
        key: ev.key,
        value: ev.value,
        is_secret: ev.is_secret || false
      }));
      
      const { data, error } = await supabase
        .from('site_env_vars')
        .insert(envVarsToInsert)
        .select();
      
      if (error) {
        console.error('Error setting env vars:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Mask secret values in response
      const maskedEnvVars = (data || []).map(ev => ({
        ...ev,
        value: ev.is_secret ? '********' : ev.value
      }));
      
      return res.status(200).json({
        message: 'Environment variables updated successfully',
        envVars: maskedEnvVars
      });
    }
    
    return res.status(200).json({
      message: 'Environment variables updated successfully',
      envVars: []
    });
  } catch (error) {
    console.error('Error setting site env vars:', error);
    return res.status(500).json({ error: 'Failed to update environment variables' });
  }
};

module.exports = {
  deploySite,
  getSiteEnvVars,
  setSiteEnvVars
};
