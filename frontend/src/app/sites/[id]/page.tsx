'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { API_URL } from '@/config';
import { getAuthToken } from '@/services/auth.service';
import SiteDeployment from '@/components/SiteDeployment';
import { 
  Box, 
  Typography, 
  Container, 
  Paper, 
  Tabs, 
  Tab, 
  Button, 
  CircularProgress,
  Breadcrumbs,
  Alert,
  Divider
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Public as PublicIcon,
  Code as CodeIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

interface Site {
  id: string;
  name: string;
  slug: string;
  status: string;
  site_url?: string;
  storage_bucket?: string;
  storage_path?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  version?: number;
  url?: string;
  display_id?: string;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // Fetch site details
  useEffect(() => {
    const fetchSiteDetails = async () => {
      try {
        setLoading(true);
        const token = await getAuthToken();
        const response = await axios.get(`${API_URL}/sites/${siteId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setSite(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching site details:', err);
        setError(err.response?.data?.error || 'Failed to load site details');
      } finally {
        setLoading(false);
      }
    };
    
    if (siteId) {
      fetchSiteDetails();
    }
  }, [siteId]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Handle deployment update
  const handleDeploymentUpdate = (deploymentData: any) => {
    if (site && deploymentData.url) {
      setSite({
        ...site,
        site_url: deploymentData.url
      });
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => router.push('/sites')}
          sx={{ mt: 2 }}
        >
          Back to Sites
        </Button>
      </Container>
    );
  }
  
  if (!site) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="warning">Site not found</Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => router.push('/sites')}
          sx={{ mt: 2 }}
        >
          Back to Sites
        </Button>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/sites" style={{ textDecoration: 'none', color: 'inherit' }}>
          Sites
        </Link>
        <Typography color="text.primary">{site.name}</Typography>
      </Breadcrumbs>
      
      {/* Site Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          {site.name}
        </Typography>
        
        <Box>
          {site.site_url && (
            <Button 
              variant="outlined" 
              startIcon={<PublicIcon />}
              href={site.site_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mr: 2 }}
            >
              Visit Site
            </Button>
          )}
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => setActiveTab(1)} // Switch to deployment tab
          >
            Deploy
          </Button>
        </Box>
      </Box>
      
      {/* Site Status */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Site Information
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Status
            </Typography>
            <Typography variant="body1">
              {site.status === 'active' ? 'Active' : 'Inactive'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Created
            </Typography>
            <Typography variant="body1">
              {new Date(site.created_at).toLocaleDateString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Last Updated
            </Typography>
            <Typography variant="body1">
              {new Date(site.updated_at).toLocaleDateString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Site URL
            </Typography>
            <Typography variant="body1">
              {site.site_url ? (
                <Link href={site.site_url} target="_blank" rel="noopener noreferrer">
                  {site.site_url}
                </Link>
              ) : (
                'Not deployed yet'
              )}
            </Typography>
          </Box>
        </Box>
      </Paper>
      
      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<CodeIcon />} label="Files" />
          <Tab icon={<PublicIcon />} label="Deployment" />
          <Tab icon={<SettingsIcon />} label="Settings" />
        </Tabs>
      </Box>
      
      <Divider sx={{ mb: 4 }} />
      
      {/* Tab Content */}
      <Box>
        {activeTab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Site Files
            </Typography>
            <Paper sx={{ p: 3 }}>
              <Typography variant="body1">
                Your site files are stored securely in our cloud storage.
              </Typography>
              {/* File listing would go here */}
            </Paper>
          </Box>
        )}
        
        {activeTab === 1 && (
          <SiteDeployment site={site} onDeploymentUpdate={handleDeploymentUpdate} />
        )}
        
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Site Settings
            </Typography>
            <Paper sx={{ p: 3 }}>
              <Typography variant="body1" gutterBottom>
                Manage your site settings here.
              </Typography>
              {/* Site settings would go here */}
              <Button 
                variant="contained" 
                color="error"
                sx={{ mt: 2 }}
                onClick={() => {
                  if (confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
                    // Delete site logic would go here
                  }
                }}
              >
                Delete Site
              </Button>
            </Paper>
          </Box>
        )}
      </Box>
    </Container>
  );
}
