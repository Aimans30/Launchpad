"use client";

import { useState } from "react";
import Link from "next/link";

export default function Projects() {
  // Mock data for projects
  const [projects, setProjects] = useState([
    {
      id: "proj_1",
      name: "Personal Blog",
      framework: "Next.js",
      status: "active",
      lastDeployed: "2023-11-15T14:32:00Z",
      url: "https://blog.example.com",
      repository: "github.com/username/personal-blog",
    },
    {
      id: "proj_2",
      name: "E-commerce Store",
      framework: "React",
      status: "active",
      lastDeployed: "2023-11-10T09:15:00Z",
      url: "https://store.example.com",
      repository: "github.com/username/ecommerce-store",
    },
    {
      id: "proj_3",
      name: "Portfolio Site",
      framework: "Astro",
      status: "building",
      lastDeployed: "2023-11-05T16:45:00Z",
      url: "https://portfolio.example.com",
      repository: "github.com/username/portfolio",
    },
    {
      id: "proj_4",
      name: "Company Website",
      framework: "Vue.js",
      status: "active",
      lastDeployed: "2023-10-28T11:20:00Z",
      url: "https://company.example.com",
      repository: "github.com/username/company-website",
    },
    {
      id: "proj_5",
      name: "Documentation Site",
      framework: "Docusaurus",
      status: "failed",
      lastDeployed: "2023-10-20T09:10:00Z",
      url: "https://docs.example.com",
      repository: "github.com/username/documentation",
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
        </div>

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">1</span> to <span className="font-medium">5</span> of <span className="font-medium">5</span> projects
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
