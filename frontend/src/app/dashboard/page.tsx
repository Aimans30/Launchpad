"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Project {
  id: string;
  name: string;
  framework: string;
  status: string;
  lastDeployed: string;
  url: string;
}

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    // Check for auth_success flag which indicates we just completed authentication
    const authSuccess = localStorage.getItem('auth_success');
    
    if (authSuccess === 'true') {
      // We just completed authentication, clear the flag and stay on dashboard
      console.log('Auth success flag found, staying on dashboard');
      localStorage.removeItem('auth_success');
      return;
    }
    
    if (!authLoading && !isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      window.location.replace('/login');
    }
  }, [authLoading, isAuthenticated]);
  
  // Fetch user's projects from the backend
  useEffect(() => {
    const fetchProjects = async () => {
      // Only fetch projects if user is authenticated and has an ID
      if (!isAuthenticated || !user?.id) {
        setProjects([]);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Log user data for debugging
        console.log('Dashboard user data:', user);
        
        // For now, use mock data but in the future fetch from API
        // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/projects`);
        // if (!response.ok) throw new Error('Failed to fetch projects');
        // const data = await response.json();
        // setProjects(data.projects);
        
        // Use mock data for now, but include user's GitHub username if available
        setProjects([
          {
            id: "proj_1",
            name: user.github_username ? `${user.github_username}'s Blog` : "Personal Blog",
            framework: "Next.js",
            status: "active",
            lastDeployed: "2023-11-15T14:32:00Z",
            url: user.github_username ? `https://${user.github_username}.github.io/blog` : "https://my-blog-site.netlify.app",
          },
          {
            id: "proj_2",
            name: "E-commerce Store",
            framework: "React",
            status: "active",
            lastDeployed: "2023-11-10T09:15:00Z",
            url: "https://store.example.com",
          },
        ]);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProjects();
  }, [user, isAuthenticated]);

  // Mock data for recent deployments
  const [recentDeployments, setRecentDeployments] = useState([
    {
      id: "dep_1",
      projectId: "proj_1",
      projectName: "Personal Blog",
      status: "success",
      timestamp: "2023-11-15T14:32:00Z",
      commit: "a1b2c3d",
      branch: "main",
    },
    {
      id: "dep_2",
      projectId: "proj_2",
      projectName: "E-commerce Store",
      status: "success",
      timestamp: "2023-11-10T09:15:00Z",
      commit: "e4f5g6h",
      branch: "main",
    },
    {
      id: "dep_3",
      projectId: "proj_3",
      projectName: "Portfolio Site",
      status: "building",
      timestamp: "2023-11-05T16:45:00Z",
      commit: "i7j8k9l",
      branch: "feature/new-design",
    },
    {
      id: "dep_4",
      projectId: "proj_1",
      projectName: "Personal Blog",
      status: "failed",
      timestamp: "2023-11-04T11:22:00Z",
      commit: "m0n1o2p",
      branch: "fix/header",
    },
  ]);

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
    
    switch(status) {
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

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</div>
          <div className="mt-6 flex justify-center">
            <svg className="animate-spin h-10 w-10 text-black dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      </div>
    );
  }
  
  // Only render dashboard if authenticated
  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Your Projects</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {projects.map((project) => (
                  <div key={project.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          <Link href={`/projects/${project.id}`} className="hover:underline">
                            {project.name}
                          </Link>
                        </h3>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{project.framework}</span>
                          <span>•</span>
                          <span>Last deployed {formatDate(project.lastDeployed)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <StatusBadge status={project.status} />
                        <Link 
                          href={`/projects/${project.id}/deploy`}
                          className="text-sm font-medium text-black dark:text-white hover:underline"
                        >
                          Deploy
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
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
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentDeployments.length}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">75%</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg. Build Time</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">45s</p>
                </div>
              </div>
            </div>

            {/* Recent Deployments */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Deployments</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {recentDeployments.slice(0, 3).map((deployment) => (
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
                ))}
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
          </div>
        </div>
      </main>
    </div>
  );
}
