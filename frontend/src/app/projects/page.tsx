"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/config/firebase";
import { useRouter } from "next/navigation";
// Using icons from react-icons which should be available
import { FaFolder as FolderIcon, FaPlus as PlusIcon } from "react-icons/fa";
import { FaGithub as GitHubIcon } from "react-icons/fa";
import GitHubAuthHelper from "@/components/GitHubAuthHelper";

interface Project {
  id: string;
  name: string;
  framework: string;
  status: string;
  lastDeployed: string;
  url: string;
  repository: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !user) {
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  // Function to fetch projects from API
  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const statusCode = response.status;
        let errorMessage = `Failed to fetch projects: ${statusCode}`;

        // Provide more specific error messages based on status code
        if (statusCode === 500) {
          errorMessage = 'The server encountered an internal error. Our team has been notified.';
        } else if (statusCode === 404) {
          errorMessage = 'The projects API endpoint could not be found. Please check the API configuration.';
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = 'You do not have permission to access this resource. Please check your authentication.';
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  // State for GitHub auth errors
  const [githubAuthError, setGithubAuthError] = useState<string | null>(null);

  // Function to fetch GitHub repositories
  const fetchGithubRepos = async () => {
    if (!auth.currentUser) return;

    setLoadingRepos(true);
    setGithubAuthError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/github/repositories`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401) {
          setGithubAuthError('GitHub authentication required. Please connect your GitHub account.');
        }
        throw new Error('Failed to fetch GitHub repositories');
      }

      const data = await response.json();
      setGithubRepos(data.repositories || []);
    } catch (err) {
      console.error('Error fetching GitHub repositories:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch projects and GitHub repositories
    fetchProjects();
    fetchGithubRepos();
  }, [auth.currentUser]);

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

    switch (status) {
      case "success":
      case "active":
        bgColor = "bg-green-100 dark:bg-green-900";
        textColor = "text-green-800 dark:text-green-200";
        break;
      case "building":
        bgColor = "bg-yellow-100 dark:bg-yellow-900";
        textColor = "text-yellow-800 dark:text-yellow-200";
        break;
      case "failed":
        bgColor = "bg-red-100 dark:bg-red-900";
        textColor = "text-red-800 dark:text-red-200";
        break;
      default:
        bgColor = "bg-gray-100 dark:bg-gray-800";
        textColor = "text-gray-800 dark:text-gray-200";
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <Link
              href="/new-project"
              className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              New Project
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                placeholder="Search projects..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent">
                <option value="">All Frameworks</option>
                <option value="nextjs">Next.js</option>
                <option value="react">React</option>
                <option value="vue">Vue.js</option>
                <option value="astro">Astro</option>
              </select>
              <select className="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="building">Building</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white dark:bg-black shadow overflow-hidden rounded-lg">
          {isLoading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="flex flex-col items-center justify-center">
                <svg className="h-10 w-10 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Loading projects...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-10 px-4">
              <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm dark:bg-red-900/20 dark:border-red-800">
                <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Error Fetching Projects</h3>
                <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">The server might be down or there could be a network issue. Please try again later.</p>
                <button
                  onClick={() => {
                    setError(null);
                    setIsLoading(true);
                    fetchProjects();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200 mx-auto block"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : !isLoading && !error && projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FolderIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No projects yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {loadingRepos ? 'Loading your GitHub repositories...' :
                  githubRepos.length > 0 ?
                    'Import a project from your GitHub repositories or create a new one.' :
                    'Connect your GitHub account to import repositories or create a new project.'}
              </p>
              <div className="mt-6 space-y-4">
                {githubRepos.length > 0 && (
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white mr-4"
                  >
                    <GitHubIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                    Import from GitHub
                  </button>
                )}
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  New Project
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="block hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <span className="text-xl font-bold text-gray-500 dark:text-gray-400">
                              {project.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{project.name}</h2>
                            <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                              <span>{project.framework}</span>
                              <span className="mx-2">•</span>
                              <span>{project.repository}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <StatusBadge status={project.status} />
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Updated {formatDate(project.lastDeployed)}
                            </div>
                          </div>
                          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* GitHub Repositories Section */}
        <div className="mt-8 bg-white dark:bg-black shadow overflow-hidden rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <GitHubIcon className="mr-2" />
              GitHub Repositories
            </h2>
          </div>
          
          {/* GitHub Auth Error and Helper */}
          {githubAuthError && (
            <div className="px-6 py-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-200">{githubAuthError}</p>
                    <div className="mt-4">
                      <GitHubAuthHelper 
                        onSuccess={() => {
                          setGithubAuthError(null);
                          fetchGithubRepos();
                        }} 
                        onError={(error) => console.error('GitHub auth error:', error)} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GitHub Repositories Content */}
          <div className="px-6 py-4">
            {loadingRepos ? (
              <div className="py-4 flex justify-center items-center">
                <div className="flex flex-col items-center justify-center">
                  <svg className="h-8 w-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">Loading repositories...</p>
                </div>
              </div>
            ) : githubRepos.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {githubRepos.map((repo) => (
                  <li key={repo.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{repo.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{repo.description || 'No description'}</p>
                      </div>
                      <button 
                        className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900"
                        onClick={() => setShowImportModal(true)}
                      >
                        Import
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !githubAuthError ? (
              <div className="text-center py-6">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Connect your GitHub account to import repositories</p>
                <GitHubAuthHelper 
                  onSuccess={() => fetchGithubRepos()} 
                  onError={(error) => setGithubAuthError(error)} 
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Pagination - only show when there are projects */}
        {!isLoading && !error && projects.length > 0 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{projects.length}</span> of <span className="font-medium">{projects.length}</span> projects
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
    </div>
  );
}
