"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id as string;

  // Mock project data
  const [project, setProject] = useState({
    id: projectId,
    name: "Personal Blog",
    framework: "Next.js",
    status: "active",
    lastDeployed: "2023-11-15T14:32:00Z",
    url: "https://blog.example.com",
    repository: "github.com/username/personal-blog",
    branch: "main",
    buildCommand: "npm run build",
    outputDirectory: "out",
    createdAt: "2023-10-01T10:00:00Z",
  });

  // Mock deployments data
  const [deployments, setDeployments] = useState([
    {
      id: "dep_1",
      status: "success",
      timestamp: "2023-11-15T14:32:00Z",
      commit: "a1b2c3d4e5f6g7h8i9j0",
      commitMessage: "Update header component styling",
      branch: "main",
      duration: 45,
    },
    {
      id: "dep_2",
      status: "success",
      timestamp: "2023-11-10T09:15:00Z",
      commit: "b2c3d4e5f6g7h8i9j0k1",
      commitMessage: "Fix mobile navigation menu",
      branch: "main",
      duration: 42,
    },
    {
      id: "dep_3",
      status: "failed",
      timestamp: "2023-11-04T11:22:00Z",
      commit: "c3d4e5f6g7h8i9j0k1l2",
      commitMessage: "Add dark mode support",
      branch: "feature/dark-mode",
      duration: 38,
      error: "Build failed: Could not resolve dependency 'theme-provider'",
    },
  ]);

  // Mock environment variables
  const [envVars, setEnvVars] = useState([
    { key: "API_URL", value: "https://api.example.com", isSecret: false },
    { key: "DATABASE_URL", value: "********", isSecret: true },
    { key: "NEXT_PUBLIC_ANALYTICS_ID", value: "UA-12345678-1", isSecret: false },
  ]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  // Handle new deployment
  const handleDeploy = () => {
    // In a real app, this would call the API to trigger a new deployment
    alert("Deployment triggered!");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mr-2"
              >
                Dashboard
              </Link>
              <span className="text-gray-500 dark:text-gray-400 mx-2">/</span>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div className="mt-4 md:mt-0 flex space-x-3">
              <a 
                href={`https://${project.url}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Visit Site
              </a>
              <button 
                onClick={handleDeploy}
                className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                Deploy
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project Info */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden mb-8">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Project Details</h2>
              </div>
              <div className="px-6 py-5">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Framework</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{project.framework}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Repository</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{project.repository}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Branch</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{project.branch}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(project.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Build Command</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{project.buildCommand}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Output Directory</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{project.outputDirectory}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Deployments */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Deployments</h2>
                <button 
                  onClick={handleDeploy}
                  className="px-3 py-1 text-xs rounded-md bg-black text-white dark:bg-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                  New Deployment
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commit</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Branch</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deployed</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-gray-800">
                    {deployments.map((deployment) => (
                      <tr key={deployment.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={deployment.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white font-mono">{deployment.commit.substring(0, 7)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{deployment.commitMessage}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {deployment.branch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {deployment.duration}s
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(deployment.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link 
                            href={`/projects/${projectId}/deployments/${deployment.id}`}
                            className="text-black dark:text-white hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* Environment Variables */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden mb-8">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Environment Variables</h2>
                <button className="px-3 py-1 text-xs rounded-md bg-black text-white dark:bg-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                  Add New
                </button>
              </div>
              <div className="px-6 py-5">
                <div className="space-y-4">
                  {envVars.map((env, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{env.key}</p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {env.isSecret ? "••••••••" : env.value}
                        </p>
                      </div>
                      <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Settings</h2>
              </div>
              <div className="px-6 py-5 space-y-6">
                <Link 
                  href={`/projects/${projectId}/settings`}
                  className="block w-full text-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Project Settings
                </Link>
                <Link 
                  href={`/projects/${projectId}/domains`}
                  className="block w-full text-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Custom Domains
                </Link>
                <button 
                  className="block w-full text-center px-4 py-2 border border-red-300 dark:border-red-700 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
