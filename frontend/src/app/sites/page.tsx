'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/config/firebase';
import Link from 'next/link';
import { FaGlobe as GlobeIcon, FaFolder as FolderIcon } from 'react-icons/fa';

interface Site {
  id: string;
  name: string;
  slug: string;
  status: string;
  site_url: string;
  created_at: string;
  updated_at: string;
}

interface FolderUploadProps {
  onFolderSelect: (files: FileList) => void;
  disabled?: boolean;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [siteName, setSiteName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    fetchSites();
  }, [user, router]);



  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Fetch from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sites/user`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const statusCode = response.status;
        let errorMessage = `Failed to fetch sites: ${statusCode}`;
        
        // Provide more specific error messages based on status code
        if (statusCode === 500) {
          errorMessage = 'The server encountered an internal error. Our team has been notified.';
        } else if (statusCode === 404) {
          // Special handling for 404 - this likely means the sites endpoint isn't implemented yet
          // or the user hasn't created any sites
          setSites([]);
          setLoading(false);
          return; // Exit early with empty sites array
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = 'You do not have permission to access this resource. Please check your authentication.';
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setSites(data.sites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!siteName.trim()) {
      setError('Site name is required');
      return;
    }
    
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: siteName })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create site');
      }
      
      const data = await response.json();
      setSites([...sites, data.site]);
      setShowCreateModal(false);
      setSiteName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleUploadSite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Please select files to upload');
      return;
    }
    
    if (!siteName.trim()) {
      setError('Site name is required');
      return;
    }
    
    try {
      setIsUploading(true);
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const formData = new FormData();
      
      // Add all files to the form data
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        // Preserve folder structure by using the relative path
        const relativePath = file.webkitRelativePath || file.name;
        formData.append('files', file, relativePath);
      }
      
      formData.append('siteName', siteName);
      
      const xhr = new XMLHttpRequest();
      // Ensure we have a valid API URL, defaulting to localhost:3001 if not set
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      xhr.open('POST', `${apiUrl}/api/sites/upload-folder`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      console.log('Sending request to:', `${apiUrl}/api/sites/upload-folder`);
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });
      
      xhr.onload = async () => {
        console.log('Response status:', xhr.status);
        console.log('Response headers:', xhr.getAllResponseHeaders());
        
        try {
          console.log('Response text:', xhr.responseText.substring(0, 200) + '...');
        } catch (e) {
          console.log('Error reading response text');
        }
        
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          console.log('Upload successful, site data:', response);
          setSites([...sites, response.site]);
          setShowUploadModal(false);
          setSiteName('');
          setSelectedFiles(null);
          setUploadProgress(0);
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.error || errorMessage;
            console.error('Upload error details:', errorResponse);
          } catch (e) {
            console.error('Error parsing error response:', e);
          }
          setError(errorMessage);
        }
        setIsUploading(false);
      };
      
      xhr.onerror = () => {
        setError('Network error occurred during upload');
        setIsUploading(false);
      };
      
      xhr.send(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsUploading(false);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete site');
      }
      
      setSites(sites.filter(site => site.id !== siteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };
  
  // Custom component for folder selection
  const FolderUpload: React.FC<FolderUploadProps> = ({ onFolderSelect, disabled }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    const handleClick = () => {
      if (inputRef.current) {
        inputRef.current.click();
      }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFolderSelect(e.target.files);
      }
    };
    
    return (
      <div className="w-full">
        <input
          type="file"
          ref={inputRef}
          onChange={handleChange}
          style={{ display: 'none' }}
          // @ts-ignore - webkitdirectory is not in the standard HTML attributes
          webkitdirectory="true"
          // @ts-ignore - directory is not in the standard HTML attributes
          directory="true"
          multiple
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Select Folder
        </button>
        {selectedFiles && selectedFiles.length > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            Selected {selectedFiles.length} files from folder
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Static Sites</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <svg className="h-16 w-16 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Loading sites...</p>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Please wait while we fetch your sites</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Static Sites</h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Upload Site
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Create Site
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm dark:bg-red-900/20 dark:border-red-800">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Error Fetching Sites</h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">The server might be down or there could be a network issue. Please try again later.</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchSites();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200 mx-auto block"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty state when no sites exist */}
      {!loading && !error && sites.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <GlobeIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No sites deployed yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sites appear here after you deploy a project through our platform.
            First create a project, then deploy it to see it listed here.
          </p>
          <div className="mt-6 space-y-4">
            <Link
              href="/projects"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
            >
              <FolderIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Go to Projects
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="border rounded-lg overflow-hidden shadow-md"
            >
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">{site.name}</h2>
                <p className="text-gray-600 mb-2">
                  Status: <span className={`font-medium ${site.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                  </span>
                </p>
                <p className="text-gray-600 mb-4">
                  Created: {new Date(site.created_at).toLocaleDateString()}
                </p>
                <div className="flex justify-between">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}${site.site_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Site
                  </a>
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Site Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Site</h2>
            <form onSubmit={handleCreateSite}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="My Awesome Site"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSiteName('');
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Site Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Upload Static Site</h2>
            <form onSubmit={handleUploadSite}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="My Awesome Site"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Select Website Folder</label>
                <FolderUpload 
                  onFolderSelect={(files) => setSelectedFiles(files)} 
                  disabled={isUploading}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Select the folder containing your built static site (with index.html in the root)
                </p>
              </div>
              
              {isUploading && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-center mt-1">{uploadProgress}% Uploaded</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSiteName('');
                    setSelectedFiles(null);
                    setUploadProgress(0);
                  }}
                  className="px-4 py-2 border rounded"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
