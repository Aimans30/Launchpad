'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  CircularProgress, 
  Paper, 
  TextField, 
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  Link,
  Alert,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from '@mui/icons-material';
import { deploySite, getSiteEnvVars, setSiteEnvVars } from '../services/deployment.service';

/**
 * Component for managing site deployment and environment variables
 */
const SiteDeployment = ({ site, onDeploymentUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState(site?.site_url || '');
  const [deploymentError, setDeploymentError] = useState('');
  const [envVars, setEnvVars] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEnvVar, setNewEnvVar] = useState({ key: '', value: '', is_secret: false });
  const [envVarsLoading, setEnvVarsLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);

  // Load environment variables when component mounts
  useEffect(() => {
    if (site?.id) {
      loadEnvVars();
    }
  }, [site?.id]);

  // Load environment variables from the server
  const loadEnvVars = async () => {
    if (!site?.id) return;
    
    try {
      setEnvVarsLoading(true);
      const vars = await getSiteEnvVars(site.id);
      setEnvVars(vars || []);
    } catch (error) {
      console.error('Failed to load environment variables:', error);
    } finally {
      setEnvVarsLoading(false);
    }
  };

  // Handle deployment button click
  const handleDeploy = async () => {
    setLoading(true);
    setDeploymentError('');
    setDeploymentSuccess(false);
    
    try {
      const result = await deploySite(site.id);
      setDeploymentUrl(result.url);
      setDeploymentSuccess(true);
      
      if (onDeploymentUpdate) {
        onDeploymentUpdate(result);
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      setDeploymentError(error.response?.data?.error || 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  // Open dialog to add new environment variable
  const handleAddEnvVar = () => {
    setNewEnvVar({ key: '', value: '', is_secret: false });
    setDialogOpen(true);
  };

  // Handle saving a new environment variable
  const handleSaveEnvVar = () => {
    if (!newEnvVar.key.trim()) {
      return;
    }
    
    // Add to local state
    const updatedEnvVars = [...envVars, newEnvVar];
    setEnvVars(updatedEnvVars);
    
    // Save to server
    saveEnvVarsToServer(updatedEnvVars);
    
    // Close dialog
    setDialogOpen(false);
  };

  // Handle deleting an environment variable
  const handleDeleteEnvVar = (index) => {
    const updatedEnvVars = [...envVars];
    updatedEnvVars.splice(index, 1);
    setEnvVars(updatedEnvVars);
    
    // Save to server
    saveEnvVarsToServer(updatedEnvVars);
  };

  // Save environment variables to the server
  const saveEnvVarsToServer = async (vars) => {
    if (!site?.id) return;
    
    try {
      setEnvVarsLoading(true);
      await setSiteEnvVars(site.id, vars);
    } catch (error) {
      console.error('Failed to save environment variables:', error);
    } finally {
      setEnvVarsLoading(false);
    }
  };

  // Toggle visibility of secret values
  const toggleSecretVisibility = (index) => {
    setShowSecrets(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Site Deployment
      </Typography>
      
      {/* Deployment Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Deploy Your Site
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 2 }}>
          Deploy your site to make it publicly accessible.
        </Typography>
        
        {deploymentSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Site deployed successfully!
          </Alert>
        )}
        
        {deploymentError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {deploymentError}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleDeploy}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Deploying...' : 'Deploy Site'}
          </Button>
        </Box>
        
        {deploymentUrl && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1">
              Your site is live at:
            </Typography>
            <Link 
              href={deploymentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              sx={{ wordBreak: 'break-all' }}
            >
              {deploymentUrl}
            </Link>
          </Box>
        )}
      </Paper>
      
      {/* Environment Variables Section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Environment Variables
          </Typography>
          
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={handleAddEnvVar}
            disabled={envVarsLoading}
          >
            Add Variable
          </Button>
        </Box>
        
        <Typography variant="body2" sx={{ mb: 2 }}>
          Environment variables are available to your site during build and runtime.
        </Typography>
        
        {envVarsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : envVars.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No environment variables set. Click "Add Variable" to create one.
          </Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell align="center">Secret</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {envVars.map((envVar, index) => (
                  <TableRow key={index}>
                    <TableCell>{envVar.key}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {envVar.is_secret && !showSecrets[index] ? (
                          '••••••••'
                        ) : (
                          envVar.value
                        )}
                        {envVar.is_secret && (
                          <IconButton 
                            size="small" 
                            onClick={() => toggleSecretVisibility(index)}
                            sx={{ ml: 1 }}
                          >
                            {showSecrets[index] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {envVar.is_secret ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton 
                          color="error" 
                          size="small"
                          onClick={() => handleDeleteEnvVar(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      
      {/* Add Environment Variable Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Add Environment Variable</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Key"
            fullWidth
            variant="outlined"
            value={newEnvVar.key}
            onChange={(e) => setNewEnvVar({ ...newEnvVar, key: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Value"
            fullWidth
            variant="outlined"
            value={newEnvVar.value}
            onChange={(e) => setNewEnvVar({ ...newEnvVar, value: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newEnvVar.is_secret}
                onChange={(e) => setNewEnvVar({ ...newEnvVar, is_secret: e.target.checked })}
              />
            }
            label="This is a secret value"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveEnvVar} 
            variant="contained"
            disabled={!newEnvVar.key.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SiteDeployment;
