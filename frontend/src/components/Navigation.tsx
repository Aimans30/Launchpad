"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  // Get user data from AuthContext
  const { user, logout } = useAuth();
  
  // Use state to handle client-side rendering
  const [mounted, setMounted] = useState(false);
  
  // Only run this effect on the client side
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Get user display name with fallbacks
  const displayName = mounted ? (user?.name || user?.github_username || 'User') : 'User';
  
  // Generate avatar URL with multiple fallbacks
  const avatarUrl = mounted && user ? (
    // Priority 1: Direct avatar URL if available
    user.avatar_url || 
    // Priority 2: GitHub username-based avatar
    (user.github_username ? `https://github.com/${user.github_username}.png` : 
    // Priority 3: GitHub ID-based avatar
    (user.github_id ? `https://avatars.githubusercontent.com/u/${user.github_id}` : 
    // Priority 4: Generate avatar from name
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D8ABC&color=fff`))
  ) : `https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff`;
    
  // Debug user data
  useEffect(() => {
    if (mounted && user) {
      console.log('Navigation component user data:', {
        name: user.name,
        github_username: user.github_username,
        avatar_url: user.avatar_url ? 'Present' : 'Not present'
      });
    }
  }, [mounted, user]);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { name: "Projects", href: "/projects", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { name: "Deployments", href: "/deployments", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
    { name: "Settings", href: "/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-4 right-4 z-50 md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-white dark:bg-black shadow-md"
          aria-expanded="false"
        >
          <span className="sr-only">Open menu</span>
          {isOpen ? (
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar for desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <Link href="/" className="text-2xl font-bold text-black dark:text-white">
                Launchpad
              </Link>
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-1">
              {navLinks.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive(item.href)
                      ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-black dark:hover:text-white'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                >
                  <svg
                    className={`${
                      isActive(item.href) ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white'
                    } mr-3 flex-shrink-0 h-6 w-6`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center">
              <div>
                <img
                  className="inline-block h-9 w-9 rounded-full"
                  src={avatarUrl}
                  alt="User avatar"
                />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
                <button
                  onClick={logout}
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      <div className={`${isOpen ? 'fixed' : 'hidden'} md:hidden inset-0 z-40 bg-gray-600 bg-opacity-75`} onClick={() => setIsOpen(false)} />

      <div className={`${isOpen ? 'fixed' : 'hidden'} md:hidden inset-y-0 left-0 z-40 w-full max-w-xs bg-white dark:bg-black shadow-lg`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
            <Link href="/" className="text-2xl font-bold text-black dark:text-white">
              Launchpad
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:text-black dark:hover:text-white focus:outline-none"
            >
              <span className="sr-only">Close menu</span>
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navLinks.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  isActive(item.href)
                    ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-black dark:hover:text-white'
                } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className={`${
                    isActive(item.href) ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white'
                  } mr-4 flex-shrink-0 h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center">
              <div>
                <img
                  className="inline-block h-10 w-10 rounded-full"
                  src={avatarUrl}
                  alt="User avatar"
                />
              </div>
              <div className="ml-3">
                <p className="text-base font-medium text-gray-900 dark:text-white">{displayName}</p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
