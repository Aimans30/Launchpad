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
      setError(null);
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Generate a site ID for this upload
      const siteId = `site-${Date.now()}`;
      
      // Create an array of all files
      const fileArray = Array.from(selectedFiles);
      console.log(`Processing ${fileArray.length} files for upload`);
      
      // Sort files by size (smallest first) for better upload experience
      fileArray.sort((a, b) => a.size - b.size);
      
      // Chunk files into batches to avoid memory issues
      const CHUNK_SIZE = 10; // Upload 10 files at a time
      const chunks = [];
      
      for (let i = 0; i < fileArray.length; i += CHUNK_SIZE) {
        chunks.push(fileArray.slice(i, i + CHUNK_SIZE));
      }
      
      console.log(`Split upload into ${chunks.length} chunks`);
      
      // Ensure we have a valid API URL, defaulting to localhost:3001 if not set
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      // Track overall progress
      let totalUploaded = 0;
      const totalFiles = fileArray.length;
      
      // Upload files in chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkNumber = i + 1;
        
        console.log(`Uploading chunk ${chunkNumber}/${chunks.length} (${chunk.length} files)`);
        
        // Create form data for this chunk
        const formData = new FormData();
        formData.append('siteName', siteName);
        formData.append('siteId', siteId); // Use the same site ID for all chunks
        formData.append('chunkNumber', String(chunkNumber));
        formData.append('totalChunks', String(chunks.length));
        
        // Add files to the form data
        for (const file of chunk) {
          // Preserve folder structure by using the relative path
          const relativePath = file.webkitRelativePath || file.name;
          formData.append('files', file, relativePath);
        }
        
        // Upload this chunk with retry logic
        const MAX_RETRIES = 3;
        let retryCount = 0;
        let uploadSuccess = false;
        
        while (retryCount <= MAX_RETRIES && !uploadSuccess) {
          try {
            // If this is a retry, wait before attempting again (exponential backoff)
            if (retryCount > 0) {
              const delay = retryCount * 2000; // 2s, 4s, 6s
              console.log(`Retry ${retryCount}/${MAX_RETRIES} for chunk ${chunkNumber} after ${delay}ms delay...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const uploadResult = await new Promise<{success: boolean, error?: string}>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', `${apiUrl}/api/sites/upload-folder`);
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
              
              // Set explicit timeouts
              xhr.timeout = 120000; // 2 minutes timeout
              
              xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                  // Calculate overall progress including completed chunks
                  const chunkProgress = event.loaded / event.total;
                  const overallProgress = ((i / chunks.length) + (chunkProgress / chunks.length)) * 100;
                  setUploadProgress(Math.round(overallProgress));
                }
              });
              
              xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                  try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({success: true, ...response});
                  } catch (e) {
                    reject(new Error('Failed to parse server response'));
                  }
                } else {
                  try {
                    const response = JSON.parse(xhr.responseText);
                    reject(new Error(response.error || 'Upload failed'));
                  } catch (e) {
                    reject(new Error(`Server error: ${xhr.status}`));
                  }
                }
              };
              
              xhr.ontimeout = () => reject(new Error(`Upload timed out after ${xhr.timeout/1000} seconds`));
              xhr.onerror = () => reject(new Error('Network error during upload'));
              xhr.send(formData);
            });
            
            // If we get here, upload was successful
            uploadSuccess = true;
            totalUploaded += chunk.length;
            console.log(`Chunk ${chunkNumber}/${chunks.length} uploaded successfully (${totalUploaded}/${totalFiles} files)`);
            break;
            
          } catch (error) {
            console.error(`Error uploading chunk ${chunkNumber} (attempt ${retryCount+1}/${MAX_RETRIES+1}):`, error);
            retryCount++;
            
            // If we've exhausted all retries, throw the error
            if (retryCount > MAX_RETRIES) {
              throw error;
            }
          }
        }
      }
      
      console.log('All chunks uploaded successfully!');
      
      // Final step - notify server that all chunks are uploaded
      const finalResponse = await fetch(`${apiUrl}/api/sites/finalize-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          siteId,
          siteName,
          totalFiles
        })
      });
      
      if (!finalResponse.ok) {
        throw new Error('Failed to finalize site upload');
      }
      
      const finalData = await finalResponse.json();
      console.log('Upload finalized:', finalData);
      
      // Success handling
      if (finalData.site) {
        setSites(prev => [...prev, finalData.site]);
      }
      
      // Reset form state
      setShowUploadModal(false);
      setSiteName('');
      setSelectedFiles(null);
      setUploadProgress(0);
      
      // Redirect to sites page
      window.location.href = '/sites';
      
      setIsUploading(false);
      
    } catch (err) {
      console.error('Upload error:', err);
      
      // Enhanced error handling - check if it's an auth error
      if (err instanceof Error && 
          (err.message.includes('authentication') || 
           err.message.includes('unauthorized') || 
           err.message.includes('401'))) {
        // Auth error - show specific message but don't redirect
        setError('Authentication error. Please try refreshing the page before uploading again.');
      } else {
        // Regular error - show message  
        setError(err instanceof Error ? err.message : 'An error occurred during upload');
      }
      
      // Always update UI state regardless of error type
      setIsUploading(false);
      
      // Show error for longer time
      setTimeout(() => {
        setError('');
      }, 10000); // Show error for 10 seconds
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
  <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
    {/* Hero section with gradient overlay */}
    <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-purple-900/90"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20"></div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-900 to-transparent"></div>
      </div>
      <div className="relative container mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-300">
          My Static Sites
        </h1>
        <p className="text-lg text-blue-100 max-w-2xl mb-8">
          Deploy and manage your static websites with ease. Launch your projects to the world in seconds.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-medium px-6 py-3 rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Site
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white font-medium px-6 py-3 rounded-lg shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Site
          </button>
        </div>
      </div>
    </div>
    <div className="container mx-auto px-4 py-12 -mt-12">
      {error && (
        <div className="mb-6">
          <div className="max-w-md mx-auto bg-red-800/20 backdrop-blur-sm border border-red-700/30 rounded-xl p-6 shadow-lg">
            <div className="relative">
              <div className="absolute -top-10 -left-10 w-20 h-20 bg-red-500/20 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-10 -right-10 w-20 h-20 bg-red-500/20 rounded-full blur-2xl"></div>
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-red-300 mb-2 text-center">Error Fetching Sites</h3>
              <p className="text-red-300 mb-4 text-center">{error}</p>
              <p className="text-gray-300 mb-4 text-sm text-center">The server might be down or there could be a network issue. Please try again later.</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  fetchSites();
                }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-500/30 mx-auto block"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
      {!loading && !error && sites.length === 0 ? (
        <div className="text-center py-20">
          <div className="relative mx-auto w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse blur-xl"></div>
            <div className="relative mx-auto w-24 h-24 bg-slate-800/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-slate-700/50 shadow-lg">
              <GlobeIcon className="h-12 w-12 text-blue-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">No Sites Deployed Yet</h3>
          <p className="mt-1 text-lg text-blue-100/70 max-w-md mx-auto mb-8">
            Sites appear here after you deploy a project through our platform.
            First create a project, then deploy it to see it listed here.
          </p>
          <div className="mt-6">
            <Link
              href="/projects"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300"
            >
              <FolderIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Go to Projects
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <div
              key={site.id}
              className="group relative bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
              <div className="relative p-6">
                <h2 className="text-2xl font-bold mb-3 text-white group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">{site.name}</h2>
                <p className="text-slate-300 mb-2 flex items-center space-x-2">
                  <span>Status:</span> 
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${site.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                    {site.status === 'active' && (
                      <span className="w-2 h-2 mr-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    )}
                    {site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                  </span>
                </p>
                <p className="text-slate-400 mb-6 text-sm">
                  Created: {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(site.created_at))}
                </p>
                <div className="flex justify-between items-center pt-4 border-t border-slate-700/50">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}${site.site_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Site
                  </a>
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="inline-flex items-center text-red-400 hover:text-red-300 transition-colors gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

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