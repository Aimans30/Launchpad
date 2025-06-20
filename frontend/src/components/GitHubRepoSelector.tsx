"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  visibility: string;
  updated_at: string;
}

interface GitHubRepoSelectorProps {
  onSelectRepo: (repo: Repository) => void;
}

export default function GitHubRepoSelector({ onSelectRepo }: GitHubRepoSelectorProps) {
  const { user, isAuthenticated } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchRepositories();
    }
  }, [isAuthenticated, user]);

  const fetchRepositories = async () => {
    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/github/repositories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }

      const data = await response.json();
      setRepositories(data.repositories);
    } catch (err: any) {
      console.error("Error fetching repositories:", err);
      setError(err.message || "Failed to fetch repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRepositories = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <p className="text-yellow-800 dark:text-yellow-200">
          Please sign in with GitHub to connect your repositories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
        />
        <button
          onClick={fetchRepositories}
          className="ml-2 p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Refresh repositories"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : filteredRepositories.length > 0 ? (
        <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 max-h-80 overflow-y-auto">
            {filteredRepositories.map((repo) => (
              <li 
                key={repo.id} 
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                onClick={() => onSelectRepo(repo)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{repo.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{repo.full_name}</p>
                    {repo.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{repo.description}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    repo.visibility === 'public' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {repo.visibility}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-8 text-center border border-gray-200 dark:border-gray-800 rounded-md">
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? "No repositories match your search" : "No repositories found"}
          </p>
        </div>
      )}
    </div>
  );
}
