"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/config/firebase";
import { useRouter } from "next/navigation";
import { FaRocket as RocketIcon, FaFolder, FaExternalLinkAlt, FaSpinner, FaEye } from "react-icons/fa";
import FileExplorer from "@/components/FileExplorer";

interface Deployment {
  id: string;
  status: string;
  deployed_at?: string;
  created_at: string;
  updated_at?: string;
  
  // Project deployment fields
  project_id?: string;
  projects?: { 
    name: string;
    framework?: string;
  };
  commit_sha?: string;
  commit_message?: string;
  branch?: string;
  duration?: number;
  deployment_url?: string;
  
  // Site deployment fields
  site_id: string;
  sites: {
    id: string;
    name: string;
    site_url: string;
    slug: string;
    status: string;
  };
  deployed_url?: string;
  file_count?: number;
}

export default function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState({
    hasToken: false,
    hasUserData: false,
    isFirebaseLoggedIn: false
  });
  
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [showFileExplorer, setShowFileExplorer] = useState(false);

  // Check auth status for display
  useEffect(() => {
    // Need to check these in useEffect because localStorage is only available client-side
    setAuthStatus({
      hasToken: !!localStorage.getItem('auth_token'),
      hasUserData: !!localStorage.getItem('user'),
      isFirebaseLoggedIn: !!auth.currentUser
    });
  }, []);

  // Function to fetch deployments from API
  const fetchDeployments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TEMPORARY: Removed authentication requirement for testing
      console.log('Fetching deployments without authentication (temporary)');
      
      // Fetch from API - use standard endpoint without authentication
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deployments`);
      
      if (!response.ok) {
        const statusCode = response.status;
        let errorMessage = `Failed to fetch deployments: ${statusCode}`;
        
        // Provide more specific error messages based on status code
        if (statusCode === 500) {
          errorMessage = 'The server encountered an internal error. Our team has been notified.';
        } else if (statusCode === 404) {
          // Special handling for 404 - this likely means the deployments endpoint isn't implemented yet
          // or the user hasn't created any deployments
          setDeployments([]);
          setIsLoading(false);
          return; // Exit early with empty deployments array
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = 'You do not have permission to access this resource. Please check your authentication.';
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setDeployments(data.deployments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployments');
      
      // If not authenticated, redirect to login
      if (err instanceof Error && err.message === 'Not authenticated') {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch deployments when component mounts
  useEffect(() => {
    // TEMPORARY: Skip authentication check
    // Check if user is authenticated from localStorage
    // const storedToken = localStorage.getItem("auth_token");
    // const storedUser = localStorage.getItem("user");
    
    // TEMPORARY: Disabled authentication check for testing
    // if (!isAuthenticated && !user && (!storedToken || !storedUser)) {
    //   // If not authenticated and no stored credentials, redirect to login
    //   router.push('/login');
    //   return;
    // }
    
    fetchDeployments();
  }, []);  // Removed dependencies to prevent unnecessary redirects

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = "";
    let textColor = "";
    let borderColor = "";
    let icon: ReactNode = null;
    
    switch(status) {
      case "success":
        bgColor = "bg-green-50 dark:bg-green-900/20";
        textColor = "text-green-700 dark:text-green-300";
        borderColor = "border-green-300 dark:border-green-700";
        icon = (
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        );
        break;
      case "building":
        bgColor = "bg-yellow-50 dark:bg-yellow-900/20";
        textColor = "text-yellow-700 dark:text-yellow-300";
        borderColor = "border-yellow-300 dark:border-yellow-700";
        icon = (
          <svg className="w-3.5 h-3.5 mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
        break;
      case "failed":
        bgColor = "bg-red-50 dark:bg-red-900/20";
        textColor = "text-red-700 dark:text-red-300";
        borderColor = "border-red-300 dark:border-red-700";
        icon = (
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        );
        break;
      default:
        bgColor = "bg-gray-50 dark:bg-gray-800/40";
        textColor = "text-gray-700 dark:text-gray-300";
        borderColor = "border-gray-300 dark:border-gray-700";
        icon = (
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${bgColor} ${textColor} ${borderColor} shadow-sm`}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deployments</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Authentication Check - Only shown when there's an error */}
        {error === 'Not authenticated' && (
          <div className="mb-8">
            <div className="bg-white dark:bg-black shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg mb-4">
                <p className="text-yellow-700 dark:text-yellow-300">
                  You need to be logged in to view deployments. Please check your authentication status below:
                </p>
              </div>
              
              <div className="mt-4">
                <p className="mb-2">
                  <strong>Authentication Token in localStorage:</strong> {authStatus.hasToken ? 'Present' : 'Missing'}
                </p>
                <p className="mb-2">
                  <strong>User Data in localStorage:</strong> {authStatus.hasUserData ? 'Present' : 'Missing'}
                </p>
                <p className="mb-4">
                  <strong>Firebase Auth Status:</strong> {authStatus.isFirebaseLoggedIn ? 'Logged In' : 'Not Logged In'}
                </p>
                
                <button
                  onClick={() => window.location.href = '/login'}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Search and Filter */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search deployments..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent">
                <option value="">All Projects</option>
                <option value="proj_1">Personal Blog</option>
                <option value="proj_2">E-commerce Store</option>
                <option value="proj_3">Portfolio Site</option>
              </select>
              <select className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent">
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="building">Building</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deployments Table */}
        <div className="shadow overflow-hidden border border-gray-200 dark:border-gray-800 sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Site
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="h-10 w-10 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading deployments...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      {/* Error state */}
                      <div className="mb-6">
                        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm dark:bg-red-900/20 dark:border-red-800">
                          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Error Fetching Deployments</h3>
                          <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
                          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">The server might be down or there could be a network issue. Please try again later.</p>
                          <button
                            onClick={() => {
                              setError(null);
                              setIsLoading(true);
                              fetchDeployments();
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200 mx-auto block"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : deployments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      {/* Empty state */}
                      <div className="text-center py-12">
                        <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                          <RocketIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No deployments yet</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Deployments appear here after you deploy a project through our platform.
                          First create a project, then deploy it to see it listed here.
                        </p>
                        <div className="mt-6 space-y-4">
                          <Link
                            href="/projects"
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
                          >
                            <FaFolder className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Go to Projects
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  deployments.map((deployment) => (
                    <tr key={deployment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={deployment.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          href={`/sites/${deployment.site_id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {deployment.sites?.name || 'Unnamed Site'}
                        </Link>
                        {deployment.file_count && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({deployment.file_count} files)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(deployment.deployed_at || deployment.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-4">
                          {deployment.sites?.site_url && (
                            <a
                              href={deployment.sites.site_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 flex items-center"
                            >
                              <span>View Site</span>
                              <FaExternalLinkAlt
                                size={12}
                                className="ml-1"
                              />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSelectedDeploymentId(deployment.id);
                              setShowFileExplorer(true);
                            }}
                            className="text-blue-500 hover:text-blue-700 flex items-center"
                          >
                            <FaFolder size={12} className="mr-1" />
                            <span>View Files</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination - only show when there are deployments */}
        {!isLoading && !error && deployments.length > 0 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{deployments.length}</span> of <span className="font-medium">{deployments.length}</span> deployments
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50" disabled>
                Previous
              </button>
              <button className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50" disabled>
                Next
              </button>
            </div>
          </div>
        )}
      </main>
      
      {/* File Explorer Modal */}
      {showFileExplorer && selectedDeploymentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Deployment Files</h2>
              <button 
                onClick={() => {
                  setShowFileExplorer(false);
                  setSelectedDeploymentId(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <FileExplorer deploymentId={selectedDeploymentId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
