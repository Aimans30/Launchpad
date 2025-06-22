"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  // Get actual user data from AuthContext
  const { user: authUser, isLoading: authLoading } = useAuth();
  
  // Initialize with empty values that will be replaced once data loads
  const [user, setUser] = useState({
    name: "",
    email: "",
    avatar: "",
    githubUsername: "",
    githubId: "",
    createdAt: "",
  });
  
  // Update user data when authUser changes
  useEffect(() => {
    if (authUser) {
      console.log('Settings user data:', authUser);
      setUser({
        name: authUser.name || "",
        email: authUser.email || "",
        avatar: authUser.avatar_url || "",
        githubUsername: authUser.github_username || "",
        githubId: authUser.github_id || "",
        createdAt: authUser.created_at || "",
      });
      
      // Update form data too
      setFormData({
        name: authUser.name || "",
        email: authUser.email || "",
      });
    }
  }, [authUser]);

  // Mock settings
  const [settings, setSettings] = useState({
    theme: "system",
    notifications: {
      email: true,
      deploymentSuccess: true,
      deploymentFailure: true,
      newFeatures: false,
    },
    defaultBranch: "main",
  });

  // Form state
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage("");
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update user data
      setUser(prev => ({
        ...prev,
        name: formData.name,
        email: formData.email,
      }));
      
      setSuccessMessage("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (name === "theme") {
      setSettings(prev => ({ ...prev, theme: value }));
    } else if (name.startsWith("notifications.")) {
      const notificationType = name.split(".")[1];
      setSettings(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [notificationType]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
        },
      }));
    } else if (name === "defaultBranch") {
      setSettings(prev => ({ ...prev, defaultBranch: value }));
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage("");
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccessMessage("Settings updated successfully");
    } catch (error) {
      console.error("Error updating settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display with validation
  const formatDate = (dateString: string) => {
    if (!dateString) {
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'N/A';
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-white dark:bg-black shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Account</h2>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <img
                      className="h-16 w-16 rounded-full"
                      src={user.avatar}
                      alt="User avatar"
                    />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{user.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      GitHub: <span className="font-medium">{user.githubUsername}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Member since {formatDate(user.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <Link
                    href="/logout"
                    className="block w-full text-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Sign Out
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Settings */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Profile</h2>
              </div>
              <form onSubmit={handleProfileSubmit} className="px-6 py-5 space-y-6">
                {successMessage && (
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded-md text-sm">
                    {successMessage}
                  </div>
                )}
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  />
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>

            {/* App Settings */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Preferences</h2>
              </div>
              <form onSubmit={handleSettingsSubmit} className="px-6 py-5 space-y-6">
                <div>
                  <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Theme
                  </label>
                  <select
                    name="theme"
                    id="theme"
                    value={settings.theme}
                    onChange={handleSettingChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  >
                    <option value="system">System Default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="defaultBranch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Default Branch
                  </label>
                  <input
                    type="text"
                    name="defaultBranch"
                    id="defaultBranch"
                    value={settings.defaultBranch}
                    onChange={handleSettingChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="notifications.email"
                          name="notifications.email"
                          type="checkbox"
                          checked={settings.notifications.email}
                          onChange={handleSettingChange}
                          className="focus:ring-black dark:focus:ring-white h-4 w-4 text-black dark:text-white border-gray-300 dark:border-gray-700 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="notifications.email" className="font-medium text-gray-700 dark:text-gray-300">Email notifications</label>
                        <p className="text-gray-500 dark:text-gray-400">Receive email notifications about your account and deployments.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="notifications.deploymentSuccess"
                          name="notifications.deploymentSuccess"
                          type="checkbox"
                          checked={settings.notifications.deploymentSuccess}
                          onChange={handleSettingChange}
                          className="focus:ring-black dark:focus:ring-white h-4 w-4 text-black dark:text-white border-gray-300 dark:border-gray-700 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="notifications.deploymentSuccess" className="font-medium text-gray-700 dark:text-gray-300">Successful deployments</label>
                        <p className="text-gray-500 dark:text-gray-400">Get notified when a deployment completes successfully.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="notifications.deploymentFailure"
                          name="notifications.deploymentFailure"
                          type="checkbox"
                          checked={settings.notifications.deploymentFailure}
                          onChange={handleSettingChange}
                          className="focus:ring-black dark:focus:ring-white h-4 w-4 text-black dark:text-white border-gray-300 dark:border-gray-700 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="notifications.deploymentFailure" className="font-medium text-gray-700 dark:text-gray-300">Failed deployments</label>
                        <p className="text-gray-500 dark:text-gray-400">Get notified when a deployment fails.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="notifications.newFeatures"
                          name="notifications.newFeatures"
                          type="checkbox"
                          checked={settings.notifications.newFeatures}
                          onChange={handleSettingChange}
                          className="focus:ring-black dark:focus:ring-white h-4 w-4 text-black dark:text-white border-gray-300 dark:border-gray-700 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="notifications.newFeatures" className="font-medium text-gray-700 dark:text-gray-300">New features</label>
                        <p className="text-gray-500 dark:text-gray-400">Get notified about new features and updates.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-black shadow rounded-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-medium text-red-600 dark:text-red-400">Danger Zone</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <button 
                  className="px-4 py-2 border border-red-300 dark:border-red-700 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
