import axios from 'axios';
import { API_URL } from '../config';
import { getAuthToken } from './auth.service';

/**
 * Deploy a site
 * @param {string} siteId - The ID of the site to deploy
 * @returns {Promise<Object>} - The deployment result
 */
export const deploySite = async (siteId) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(
      `${API_URL}/sites/${siteId}/deploy`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error deploying site:', error);
    throw error;
  }
};

/**
 * Get environment variables for a site
 * @param {string} siteId - The ID of the site
 * @returns {Promise<Array>} - The environment variables
 */
export const getSiteEnvVars = async (siteId) => {
  try {
    const token = await getAuthToken();
    const response = await axios.get(
      `${API_URL}/sites/${siteId}/env`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data.envVars;
  } catch (error) {
    console.error('Error getting site environment variables:', error);
    throw error;
  }
};

/**
 * Set environment variables for a site
 * @param {string} siteId - The ID of the site
 * @param {Array<Object>} envVars - Array of environment variable objects
 * @returns {Promise<Object>} - The result
 */
export const setSiteEnvVars = async (siteId, envVars) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(
      `${API_URL}/sites/${siteId}/env`,
      { envVars },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error setting site environment variables:', error);
    throw error;
  }
};
