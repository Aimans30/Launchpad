"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Project {
  id: string;
  name: string;
  description: string | null;
  html_url: string;
  updated_at: string;
  language: string | null;
  visibility: string;
  fork: boolean;
  stargazers_count: number;
}

interface Deployment {
  id: string;
  projectName: string;
  status: string;
  timestamp: string;
  branch: string;
  commit: string;
}

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for deployments
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(true);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  
  // State for sites
  const [sites, setSites] = useState<any[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  
  // We'll implement actual API calls for deployments later
  // For now, we'll just simulate loading and then show empty state
  useEffect(() => {
    // Simulate API call for deployments
    const fetchDeployments = async () => {
      setDeploymentsLoading(true);
      try {
        // In the future, this would be a real API call
        // const response = await fetch('/api/deployments');
        // const data = await response.json();
        // setDeployments(data);
        
        // For now, set empty deployments after a delay
        setTimeout(() => {
          setDeployments([]);
          setDeploymentsLoading(false);
        }, 1000);
      } catch (err) {
        setDeploymentsError('Failed to load deployments');
        setDeploymentsLoading(false);
      }
    };
    
    // Simulate API call for sites
    const fetchSites = async () => {
      setSitesLoading(true);
      try {
        // In the future, this would be a real API call
        // const response = await fetch('/api/sites');
        // const data = await response.json();
        // setSites(data);
        
        // For now, set empty sites after a delay
        setTimeout(() => {
          setSites([]);
          setSitesLoading(false);
        }, 1000);
      } catch (err) {
        setSitesError('Failed to load sites');
        setSitesLoading(false);
      }
    };
    
    if (isAuthenticated && user) {
      fetchDeployments();
      fetchSites();
    }
  }, [isAuthenticated, user]);

  // Fetch GitHub repositories
  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setProjects([]);
      setIsLoading(false);
      return;
    }
    
    // Check if we have a GitHub username
    if (!user.github_username) {
      console.log('No GitHub username found in user object:', user);
      setError('GitHub username not found. Please reconnect your GitHub account.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching repositories for GitHub user:', user.github_username);
      const response = await fetch(`https://api.github.com/users/${user.github_username}/repos?sort=updated&per_page=10`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('GitHub API error:', response.status, errorText);
        throw new Error(`Failed to fetch repositories: ${response.status}`);
      }
      
      const repos = await response.json();
      console.log('Fetched repositories:', repos.length);
      
      setProjects(repos.map((repo: any) => ({
        id: repo.id.toString(),
        name: repo.name,
        description: repo.description,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
        language: repo.language,
        visibility: repo.visibility,
        fork: repo.fork,
        stargazers_count: repo.stargazers_count
      })));
    } catch (err) {
      console.error('Error fetching repositories:', err);
      setError('Failed to load GitHub repositories. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (user && isAuthenticated) fetchProjects();
  }, [user, isAuthenticated, fetchProjects]);

  function formatDate(dateString: string) {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  function StatusBadge({ status }: { status: string }) {
    let bgColor = '', textColor = '';
    switch (status.toLowerCase()) {
      case 'success': bgColor = 'bg-green-100 dark:bg-green-900'; textColor = 'text-green-800 dark:text-green-300'; break;
      case 'failed': bgColor = 'bg-red-100 dark:bg-red-900'; textColor = 'text-red-800 dark:text-red-300'; break;
      case 'building': bgColor = 'bg-yellow-100 dark:bg-yellow-900'; textColor = 'text-yellow-800 dark:text-yellow-300'; break;
      default: bgColor = 'bg-gray-100 dark:bg-gray-800'; textColor = 'text-gray-800 dark:text-gray-300';
    }
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} capitalize`}>{status}</span>;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-black dark:border-white border-r-transparent align-[-0.125em]" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null; // Redirect handled elsewhere

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome back, {user?.name || user?.github_username || 'Developer'}!</h1>
          <p className="text-gray-600 dark:text-gray-400">Here's what's happening with your projects.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Your GitHub Projects</h2>
                <a
                  href={`https://github.com/${user?.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View on GitHub
                </a>
              </div>
              <div>
                {isLoading ? (
                  <div className="p-6 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black dark:border-white border-r-transparent align-[-0.125em]" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading your repositories...</p>
                  </div>
                ) : error ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="mt-4 text-red-500">{error}</p>
                    <button 
                      onClick={fetchProjects} 
                      className="mt-4 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      Try Again
                    </button>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">No GitHub repositories found.</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Create a new repository on GitHub to get started.</p>
                    <a 
                      href="https://github.com/new" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      Create Repository
                    </a>
                  </div>
                ) : (
                  <div>
                    {projects.map((project) => (
                      <div key={project.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div className="mb-2 sm:mb-0">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              <a href={project.html_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {project.name}
                              </a>
                            </h3>
                            {project.description && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                {project.description}
                              </p>
                            )}
                            <div className="mt-1 flex items-center space-x-4 text-xs">
                              {project.language && (
                                <span className="text-gray-500 dark:text-gray-400">{project.language}</span>
                              )}
                              <span className="text-gray-500 dark:text-gray-400">
                                Updated {formatDate(project.updated_at)}
                              </span>
                              <span className="flex items-center text-gray-500 dark:text-gray-400">
                                <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                                </svg>
                                {project.visibility}
                              </span>
                              <span className="flex items-center text-gray-500 dark:text-gray-400">
                                <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" clipRule="evenodd" />
                                </svg>
                                {project.stargazers_count}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/deploy?repo=${project.name}`}
                              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                            >
                              Deploy
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                <Link
                  href="/projects"
                  className="text-sm font-medium text-black dark:text-white hover:underline"
                >
                  View all projects →
                </Link>
              </div>
            </div>
          </div>
          {/* Stats Section */}
          <div>
            <div className="bg-white dark:bg-black shadow rounded-lg p-6 mb-8">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Projects</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Deployments</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{deployments.length}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sites</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{sites.length}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">GitHub Repos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
                </div>
              </div>
            </div>
            {/* Recent Deployments */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Deployments</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {deploymentsLoading ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-8 w-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading deployments...</p>
                  </div>
                ) : deploymentsError ? (
                  <div className="px-6 py-6 text-center">
                    <p className="text-sm text-red-500">{deploymentsError}</p>
                  </div>
                ) : deployments.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">No deployments yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Deploy your first project to get started</p>
                    <Link
                      href="/deploy"
                      className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      Create Deployment
                    </Link>
                  </div>
                ) : (
                  deployments.slice(0, 3).map((deployment: Deployment) => (
                    <div key={deployment.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {deployment.projectName}
                          </h3>
                          <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{deployment.branch}</span>
                            <span>•</span>
                            <span className="font-mono">{deployment.commit.substring(0, 7)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <StatusBadge status={deployment.status} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(deployment.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                <Link
                  href="/deployments"
                  className="text-sm font-medium text-black dark:text-white hover:underline"
                >
                  View all deployments →
                </Link>
              </div>
            </div>
            
            {/* Sites Section */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden mt-8">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Your Sites</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {sitesLoading ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-8 w-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading your sites...</p>
                  </div>
                ) : sitesError ? (
                  <div className="px-6 py-6 text-center">
                    <p className="text-sm text-red-500">{sitesError}</p>
                  </div>
                ) : sites.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">No sites deployed yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Deploy a project to create your first site</p>
                    <Link
                      href="/deploy"
                      className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      Deploy a Site
                    </Link>
                  </div>
                ) : (
                  sites.slice(0, 3).map((site: any) => (
                    <div key={site.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {site.name}
                          </h3>
                          <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{site.url}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            Visit
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                <Link
                  href="/sites"
                  className="text-sm font-medium text-black dark:text-white hover:underline"
                >
                  View all sites →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}