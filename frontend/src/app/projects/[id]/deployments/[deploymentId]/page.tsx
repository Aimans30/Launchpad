"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DeploymentDetail({ params }: { params: { id: string, deploymentId: string } }) {
  const { id: projectId, deploymentId } = params;

  // Mock deployment data
  const [deployment, setDeployment] = useState({
    id: deploymentId,
    projectId: projectId,
    projectName: "Personal Blog",
    status: "success",
    timestamp: "2023-11-15T14:32:00Z",
    commit: "a1b2c3d4e5f6g7h8i9j0",
    commitMessage: "Update header component styling",
    branch: "main",
    duration: 45,
    author: "John Doe",
    authorEmail: "john@example.com",
    url: "https://blog-a1b2c3.example.com",
    logs: [
      { time: "14:32:00", level: "info", message: "Build started" },
      { time: "14:32:05", level: "info", message: "Installing dependencies" },
      { time: "14:32:20", level: "info", message: "Dependencies installed successfully" },
      { time: "14:32:25", level: "info", message: "Running build command: npm run build" },
      { time: "14:32:40", level: "info", message: "Build completed successfully" },
      { time: "14:32:45", level: "info", message: "Deploying to production" },
      { time: "14:32:50", level: "info", message: "Deployment successful" },
    ],
    buildConfig: {
      framework: "Next.js",
      nodeVersion: "18.x",
      buildCommand: "npm run build",
      outputDirectory: ".next",
      installCommand: "npm install",
    },
    environmentVariables: [
      { key: "NODE_ENV", value: "production" },
      { key: "API_URL", value: "https://api.example.com" },
    ],
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = "";
    let textColor = "";
    
    switch(status) {
      case "success":
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

  // Log level badge component
  const LogLevelBadge = ({ level }: { level: string }) => {
    let bgColor = "";
    let textColor = "";
    
    switch(level) {
      case "info":
        bgColor = "bg-blue-100 dark:bg-blue-900";
        textColor = "text-blue-800 dark:text-blue-200";
        break;
      case "warning":
        bgColor = "bg-yellow-100 dark:bg-yellow-900";
        textColor = "text-yellow-800 dark:text-yellow-200";
        break;
      case "error":
        bgColor = "bg-red-100 dark:bg-red-900";
        textColor = "text-red-800 dark:text-red-200";
        break;
      default:
        bgColor = "bg-gray-100 dark:bg-gray-800";
        textColor = "text-gray-800 dark:text-gray-200";
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center">
                <Link 
                  href={`/projects/${projectId}`}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {deployment.projectName}
                </Link>
                <svg className="h-5 w-5 text-gray-400 mx-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">Deployment {deployment.id.substring(0, 7)}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {deployment.commitMessage}
              </h1>
              <div className="flex items-center mt-2">
                <StatusBadge status={deployment.status} />
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Deployed {formatDate(deployment.timestamp)}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              {deployment.status === "success" && (
                <a 
                  href={deployment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                  Visit Site
                </a>
              )}
              <button className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                Redeploy
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Deployment Info */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Deployment Info</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    <StatusBadge status={deployment.status} />
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Commit</h3>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{deployment.commit}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Branch</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{deployment.branch}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Author</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{deployment.author} ({deployment.authorEmail})</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Deployed</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(deployment.timestamp)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{deployment.duration} seconds</p>
                </div>
                {deployment.url && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">URL</h3>
                    <a 
                      href={deployment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {deployment.url}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Build Configuration</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Framework</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{deployment.buildConfig.framework}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Node Version</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{deployment.buildConfig.nodeVersion}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Install Command</h3>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{deployment.buildConfig.installCommand}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Build Command</h3>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{deployment.buildConfig.buildCommand}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Output Directory</h3>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{deployment.buildConfig.outputDirectory}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Environment Variables</h2>
              </div>
              <div className="px-6 py-5">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {deployment.environmentVariables.map((env, index) => (
                        <tr key={index}>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">{env.key}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">{env.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Deployment Logs */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Deployment Logs</h2>
              </div>
              <div className="px-6 py-5">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 font-mono text-sm overflow-x-auto">
                  <div className="space-y-2">
                    {deployment.logs.map((log, index) => (
                      <div key={index} className="flex">
                        <span className="text-gray-500 dark:text-gray-400 mr-4">{log.time}</span>
                        <LogLevelBadge level={log.level} />
                        <span className="ml-2 text-gray-900 dark:text-white">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
