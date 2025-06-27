"use client";

import { useState, useEffect } from "react";
import { FaFolder, FaFile, FaChevronRight, FaChevronDown, FaExternalLinkAlt } from "react-icons/fa";

interface FileExplorerProps {
  deploymentId: string;
  apiUrl?: string;
}

interface FileItem {
  name: string;
  id: string;
  metadata: {
    size: number;
    mimetype?: string;
    cacheControl?: string;
    lastModified?: string;
  };
  isFolder?: boolean;
  children?: FileItem[];
}

const FileExplorer = ({ deploymentId, apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001' }: FileExplorerProps) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string>("");
  const [siteUrl, setSiteUrl] = useState<string>("");

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // TEMPORARY: Skip authentication check
        // const token = localStorage.getItem("auth_token");
        // if (!token) {
        //   throw new Error("Not authenticated");
        // }
        
        // Fetch without authentication header
        const response = await fetch(`${apiUrl}/api/deployments/${deploymentId}/files`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch files: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data); // Debug log
        
        // Process files into a tree structure
        const processedFiles = processFilesIntoTree(data.files || []);
        
        setFiles(processedFiles);
        setPath(data.path || "");
        
        // Handle site URL with better error checking
        if (data.url && typeof data.url === 'string' && data.url.startsWith('http')) {
          console.log('Setting site URL:', data.url);
          setSiteUrl(data.url);
        } else {
          console.log('No valid site URL found in response:', data.url);
          setSiteUrl("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (deploymentId) {
      fetchFiles();
    }
  }, [deploymentId, apiUrl]);
  
  // Process flat file list into a tree structure
  const processFilesIntoTree = (fileList: any[]): FileItem[] => {
    const root: FileItem[] = [];
    const folders: Record<string, FileItem> = {};
    
    // First pass: create all folders
    fileList.forEach(file => {
      if (file.metadata?.mimetype === 'application/x-directory' || !file.metadata?.mimetype) {
        const folder: FileItem = {
          name: file.name,
          id: file.id,
          metadata: file.metadata || { size: 0 },
          isFolder: true,
          children: []
        };
        folders[file.name] = folder;
        root.push(folder);
      }
    });
    
    // Second pass: add all files
    fileList.forEach(file => {
      if (file.metadata?.mimetype !== 'application/x-directory' && file.metadata?.mimetype) {
        const fileItem: FileItem = {
          name: file.name,
          id: file.id,
          metadata: file.metadata
        };
        
        // Check if this file belongs in a folder
        let belongsToFolder = false;
        Object.keys(folders).forEach(folderName => {
          if (file.name.startsWith(`${folderName}/`)) {
            const relativePath = file.name.substring(folderName.length + 1);
            if (!relativePath.includes('/')) {
              // Direct child of this folder
              folders[folderName].children?.push(fileItem);
              belongsToFolder = true;
            }
          }
        });
        
        if (!belongsToFolder) {
          root.push(fileItem);
        }
      }
    });
    
    return root;
  };
  
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFileUrl = (fileName: string): string => {
    // If we have a site URL, use it as the base for constructing file URLs
    if (siteUrl) {
      // For files that are part of the site, we should use the site's public URL
      // Extract the base URL from the site URL (remove index.html if present)
      const baseUrl = siteUrl.replace(/\/index\.html$/, '');
      
      // Get the directory part of the site URL
      const urlParts = baseUrl.split('/');
      const baseDirectory = urlParts.slice(0, -1).join('/');
      
      // Use the full file path to ensure we're accessing the correct file
      return `${baseDirectory}/${fileName}`;
    }
    
    // Fallback to API endpoint if no site URL is available
    // Use the correct API endpoint pattern for accessing deployment files
    return `${apiUrl}/api/deployments/${deploymentId}/files/${encodeURIComponent(fileName)}`;
  };
  
  const renderFileItem = (file: FileItem, depth = 0) => {
    const isExpanded = expandedFolders[file.id];
    const paddingLeft = `${depth * 20}px`;
    
    if (file.isFolder) {
      return (
        <div key={file.id}>
          <div 
            className="flex items-center py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            onClick={() => toggleFolder(file.id)}
            style={{ paddingLeft }}
          >
            <span className="mr-1">
              {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
            </span>
            <FaFolder className="mr-2 text-blue-500" />
            <span>{file.name}</span>
          </div>
          
          {isExpanded && file.children && (
            <div>
              {file.children.map(child => renderFileItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div 
          key={file.id}
          className="flex items-center py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ paddingLeft }}
        >
          <FaFile className="mr-2 text-gray-500" />
          <span className="flex-1">{file.name.split('/').pop()}</span>
          <span className="text-xs text-gray-500 mr-2">{formatFileSize(file.metadata.size)}</span>
          <a 
            href={getFileUrl(file.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <FaExternalLinkAlt size={12} />
          </a>
        </div>
      );
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading files: {error}
      </div>
    );
  }
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 border-b">
        <h3 className="text-lg font-medium">Deployment Files</h3>
        <div className="mt-2">
          {siteUrl ? (
            <a 
              href={siteUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 flex items-center"
            >
              <span>View Live Site</span>
              <FaExternalLinkAlt size={12} className="ml-1" />
            </a>
          ) : (
            <div className="text-gray-500 text-sm flex items-center">
              <span>Site URL not available</span>
              <button 
                className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                onClick={() => {
                  // Force refresh the file list
                  const fetchFiles = async () => {
                    try {
                      const response = await fetch(`${apiUrl}/api/deployments/${deploymentId}/files`);
                      if (response.ok) {
                        const data = await response.json();
                        console.log('Refreshed API response:', data);
                        const processedFiles = processFilesIntoTree(data.files || []);
                        setFiles(processedFiles);
                        setPath(data.path || "");
                        if (data.url && typeof data.url === 'string' && data.url.startsWith('http')) {
                          setSiteUrl(data.url);
                        }
                      }
                    } catch (err) {
                      console.error('Error refreshing files:', err);
                    }
                  };
                  fetchFiles();
                }}
              >
                (Refresh)
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 max-h-96 overflow-y-auto">
        {files.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            No files found in this deployment.
          </div>
        ) : (
          <div>
            {files.map(file => renderFileItem(file))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
