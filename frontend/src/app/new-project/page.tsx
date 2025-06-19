"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewProject() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    repository: "",
    branch: "main",
    framework: "nextjs",
    buildCommand: "",
    outputDirectory: "",
  });

  const frameworks = [
    { id: "nextjs", name: "Next.js", buildCommand: "npm run build", outputDirectory: ".next" },
    { id: "react", name: "React", buildCommand: "npm run build", outputDirectory: "build" },
    { id: "vue", name: "Vue.js", buildCommand: "npm run build", outputDirectory: "dist" },
    { id: "angular", name: "Angular", buildCommand: "ng build", outputDirectory: "dist" },
    { id: "svelte", name: "Svelte", buildCommand: "npm run build", outputDirectory: "public" },
    { id: "astro", name: "Astro", buildCommand: "npm run build", outputDirectory: "dist" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-fill build command and output directory based on framework
    if (name === "framework") {
      const selectedFramework = frameworks.find(f => f.id === value);
      if (selectedFramework) {
        setFormData(prev => ({
          ...prev,
          framework: value,
          buildCommand: selectedFramework.buildCommand,
          outputDirectory: selectedFramework.outputDirectory
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      // In a real implementation, this would call the API to create a new project
      console.log("Creating project:", formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to the project page (using a fake ID for now)
      router.push("/projects/new_project_123");
    } catch (err) {
      console.error("Error creating project:", err);
      setError("Failed to create project. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link 
              href="/dashboard" 
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mr-2"
            >
              Dashboard
            </Link>
            <span className="text-gray-500 dark:text-gray-400 mx-2">/</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Project</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Project Details</h2>
          </div>
          
          {error && (
            <div className="px-6 py-4 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
            {/* Project Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Project Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                placeholder="My Awesome Project"
              />
            </div>
            
            {/* Repository */}
            <div>
              <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Git Repository
              </label>
              <input
                type="text"
                name="repository"
                id="repository"
                required
                value={formData.repository}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                placeholder="https://github.com/username/repo"
              />
            </div>
            
            {/* Branch */}
            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Branch
              </label>
              <input
                type="text"
                name="branch"
                id="branch"
                value={formData.branch}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                placeholder="main"
              />
            </div>
            
            {/* Framework */}
            <div>
              <label htmlFor="framework" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Framework
              </label>
              <select
                name="framework"
                id="framework"
                value={formData.framework}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
              >
                {frameworks.map(framework => (
                  <option key={framework.id} value={framework.id}>
                    {framework.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Build Command */}
            <div>
              <label htmlFor="buildCommand" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Build Command
              </label>
              <input
                type="text"
                name="buildCommand"
                id="buildCommand"
                value={formData.buildCommand}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent font-mono"
                placeholder="npm run build"
              />
            </div>
            
            {/* Output Directory */}
            <div>
              <label htmlFor="outputDirectory" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Output Directory
              </label>
              <input
                type="text"
                name="outputDirectory"
                id="outputDirectory"
                value={formData.outputDirectory}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent font-mono"
                placeholder="dist"
              />
            </div>
            
            {/* Submit Button */}
            <div className="flex justify-end">
              <Link
                href="/dashboard"
                className="mr-3 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
