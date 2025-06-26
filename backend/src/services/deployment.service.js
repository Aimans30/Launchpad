/**
 * Deployment Service
 * Handles website deployment and environment variable management
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
 * Deploy a website from Supabase Storage
 * @param {string} siteId - The ID of the site to deploy
 * @param {string} userId - The ID of the user who owns the site
 * @returns {Promise<Object>} - Deployment result with URL and status
 */
async function deploySite(siteId, userId) {
  try {
    // Get site details from database
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching site for deployment:', error);
      return { success: false, error: 'Site not found or access denied' };
    }
    
    if (!site) {
      return { success: false, error: 'Site not found' };
    }
    
    // Site is already deployed via Supabase Storage
    // Just need to update the deployment status
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .upsert({
        site_id: siteId,
        status: 'active',
        deployed_url: site.site_url,
        deployed_at: new Date().toISOString(),
        version: (site.version || 0) + 1
      })
      .select()
      .single();
    
    if (deploymentError) {
      console.error('Error creating deployment record:', deploymentError);
      return { 
        success: true, 
        warning: 'Site is accessible but deployment record failed',
        url: site.site_url
      };
    }
    
    return {
      success: true,
      url: site.site_url,
      deployment: deployment
    };
  } catch (error) {
    console.error('Error deploying site:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get environment variables for a site
 * @param {string} siteId - The ID of the site
 * @param {string} userId - The ID of the user who owns the site
 * @returns {Promise<Object>} - Environment variables
 */
async function getSiteEnvVars(siteId, userId) {
  try {
    const { data, error } = await supabase
      .from('site_env_vars')
      .select('*')
      .eq('site_id', siteId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching site env vars:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, envVars: data || [] };
  } catch (error) {
    console.error('Error getting site env vars:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set environment variables for a site
 * @param {string} siteId - The ID of the site
 * @param {string} userId - The ID of the user who owns the site
 * @param {Array<Object>} envVars - Array of env var objects with key and value
 * @returns {Promise<Object>} - Result of the operation
 */
async function setSiteEnvVars(siteId, userId, envVars) {
  try {
    // First check if user owns the site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', userId)
      .single();
    
    if (siteError || !site) {
      return { success: false, error: 'Site not found or access denied' };
    }
    
    // Delete existing env vars
    const { error: deleteError } = await supabase
      .from('site_env_vars')
      .delete()
      .eq('site_id', siteId);
    
    if (deleteError) {
      console.error('Error deleting existing env vars:', deleteError);
      return { success: false, error: deleteError.message };
    }
    
    // Insert new env vars
    if (envVars && envVars.length > 0) {
      const envVarsToInsert = envVars.map(ev => ({
        site_id: siteId,
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
        return { success: false, error: error.message };
      }
      
      return { success: true, envVars: data };
    }
    
    return { success: true, envVars: [] };
  } catch (error) {
    console.error('Error setting site env vars:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  deploySite,
  getSiteEnvVars,
  setSiteEnvVars
};
