"use client";

import { useState, ReactNode } from "react";
import Link from "next/link";

export default function Deployments() {
  // Mock data for deployments
  const [deployments, setDeployments] = useState([
    {
      id: "dep_1",
      projectId: "proj_1",
      projectName: "Personal Blog",
      status: "success",
      timestamp: "2023-11-15T14:32:00Z",
      commit: "a1b2c3d4e5f6g7h8i9j0",
      commitMessage: "Update header component styling",
      branch: "main",
      duration: 45,
    },
    {
      id: "dep_3",
      projectId: "proj_3",
      projectName: "Portfolio Site",
      status: "building",
      timestamp: "2023-11-05T16:45:00Z",
      commit: "c3d4e5f6g7h8i9j0k1l2",
      commitMessage: "Add dark mode support",
      branch: "feature/dark-mode",
      duration: 38,
    },
    {
      id: "dep_4",
      projectId: "proj_1",
      projectName: "Personal Blog",
      status: "failed",
      timestamp: "2023-11-04T11:22:00Z",
      commit: "d4e5f6g7h8i9j0k1l2m3",
      commitMessage: "Implement authentication",
      branch: "feature/auth",
      duration: 51,
      error: "Build failed: Could not resolve dependency 'auth-provider'",
    },
    {
      id: "dep_5",
      projectId: "proj_4",
      projectName: "Company Website",
      status: "success",
      timestamp: "2023-10-28T11:20:00Z",
      commit: "e5f6g7h8i9j0k1l2m3n4",
      commitMessage: "Update team page",
      branch: "main",
      duration: 39,
    },
    {
      id: "dep_6",
      projectId: "proj_5",
      projectName: "Documentation Site",
      status: "failed",
      timestamp: "2023-10-20T09:10:00Z",
      commit: "f6g7h8i9j0k1l2m3n4o5",
      commitMessage: "Update API documentation",
      branch: "main",
      duration: 47,
      error: "Build failed: Invalid MDX syntax",
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
                <option value="proj_4">Company Website</option>
                <option value="proj_5">Documentation Site</option>
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
        <div className="bg-white dark:bg-black shadow overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project</th>
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
                      <Link 
                        href={`/projects/${deployment.projectId}`}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:underline"
                      >
                        {deployment.projectName}
                      </Link>
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
                        href={`/projects/${deployment.projectId}/deployments/${deployment.id}`}
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

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">1</span> to <span className="font-medium">6</span> of <span className="font-medium">6</span> deployments
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
      </main>
    </div>
  );
}
