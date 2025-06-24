"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "@/context/AuthContext";
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/config/firebase';

export default function Home() {
  const { githubLogin, isAuthenticated, isLoading: authContextLoading, handleRedirectResult, authError } = useAuth();
  const router = useRouter();
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Handle authentication and redirects
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Debug current auth state
        console.log('Homepage - Auth check:', {
          hasStoredToken: !!localStorage.getItem('auth_token'),
          hasStoredUser: !!localStorage.getItem('user'),
          isAuthenticated,
          githubAuthInProgress: sessionStorage.getItem('github_auth_in_progress'),
          authSuccess: localStorage.getItem('auth_success'),
          firebaseUser: !!auth.currentUser,
          firebaseEmail: auth.currentUser?.email
        });
        
        // If we have a GitHub auth in progress, handle it
        const githubAuthInProgress = sessionStorage.getItem('github_auth_in_progress');
        if (githubAuthInProgress) {
          console.log('Detected GitHub auth in progress, handling redirect result');
          setIsRedirecting(true);
          await handleRedirectResult();
          
          // Check if handleRedirectResult did its job
          // If not, we'll check below for auth_success flag
          console.log('Finished handling redirect result');
        }
        
        // After handling any potential redirects, check if we should go to dashboard
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user');
        const authSuccess = localStorage.getItem('auth_success');
        
        if (authSuccess === 'true') {
          console.log('Auth success flag found, redirecting to dashboard');
          localStorage.removeItem('auth_success');
          setIsRedirecting(true);
          window.location.replace('/dashboard');
          return;
        }
        
        // If authenticated through any means, go to dashboard
        if (isAuthenticated || (storedToken && storedUser)) {
          console.log('User is authenticated, redirecting to dashboard');
          setIsRedirecting(true);
          router.replace('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error checking authentication status:', error);
      } finally {
        setIsPageLoading(false);
      }
    };
    
    if (!authContextLoading) {
      checkAuth();
    }
  }, [handleRedirectResult, isAuthenticated, router, authContextLoading]);

  // Debug any existing auth data
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('auth_token');
    console.log('Homepage - Auth check:', { 
      isAuthenticated, 
      hasStoredUser: !!storedUser,
      hasStoredToken: !!storedToken
    });
  }, [isAuthenticated]);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleGitHubLogin = async () => {
    try {
      console.log('Starting GitHub login from homepage');
      await githubLogin();
      // The page will redirect to GitHub OAuth at this point
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Redirecting to Dashboard...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-black text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20 z-0"></div>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>
      
      {/* Content container */}
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Logo with glow effect */}
          <div className="mb-16 relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 opacity-50 blur-lg"></div>
            <Image src="/logo.svg" alt="Launchpad" width={180} height={180} priority className="relative drop-shadow-2xl" />
            
            <h1 className="mt-10 text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-cyan-200 to-purple-300 drop-shadow-lg">
              Welcome to Launchpad
            </h1>
            <p className="mt-6 text-2xl bg-gradient-to-r from-blue-200 via-blue-300 to-purple-200 bg-clip-text text-transparent max-w-2xl mx-auto">
              Your mission control for easy deployment of web apps.
            </p>
            
            {/* Animated highlight line */}
            <div className="mt-6 h-0.5 w-32 mx-auto bg-gradient-to-r from-blue-500 to-purple-500 animate-gradient-x"></div>
          </div>

          {authContextLoading || isPageLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
              <span className="ml-3 text-blue-300">Loading...</span>
            </div>
          ) : isRedirecting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
              <span className="ml-3 text-blue-300">Redirecting to Dashboard...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {authError && (
                <div className="p-3 bg-red-900 text-red-100 rounded-lg mb-4">
                  {authError}
                </div>
              )}
              <button
                onClick={() => handleGitHubLogin()}
                className="flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition duration-300"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path>
                </svg>
                Sign in with GitHub
              </button>
              
              <div className="text-blue-400 mt-8">
                <p>Deploy your apps to the cloud with a single click</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-black">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Why Choose Launchpad?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Lightning Fast Deployments</h3>
              <p className="text-gray-600 dark:text-gray-400">Deploy your website in seconds, not minutes. Our optimized build process gets your site online faster.</p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure by Default</h3>
              <p className="text-gray-600 dark:text-gray-400">All deployments come with HTTPS, environment variable protection, and secure access controls.</p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Preview Deployments</h3>
              <p className="text-gray-600 dark:text-gray-400">Every pull request gets its own preview deployment, making collaboration and testing a breeze.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Frameworks Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-16">Supports All Major Frameworks</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8">
            {/* Framework logos would go here */}
            <div className="flex items-center justify-center p-4 grayscale hover:grayscale-0 transition-all">
              <p className="font-mono font-semibold">Next.js</p>
            </div>
            <div className="flex items-center justify-center p-4 grayscale hover:grayscale-0 transition-all">
              <p className="font-mono font-semibold">React</p>
            </div>
            <div className="flex items-center justify-center p-4 grayscale hover:grayscale-0 transition-all">
              <p className="font-mono font-semibold">Vue</p>
            </div>
            <div className="flex items-center justify-center p-4 grayscale hover:grayscale-0 transition-all">
              <p className="font-mono font-semibold">Angular</p>
            </div>
            <div className="flex items-center justify-center p-4 grayscale hover:grayscale-0 transition-all">
              <p className="font-mono font-semibold">Svelte</p>
            </div>
            <div className="flex items-center justify-center p-4 grayscale hover:grayscale-0 transition-all">
              <p className="font-mono font-semibold">Astro</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-black text-white dark:bg-white dark:text-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Launch Your Website?</h2>
          <p className="text-lg mb-10 text-gray-300 dark:text-gray-700">Join thousands of developers who trust Launchpad for their web deployment needs.</p>
          <Link 
            href="/signup" 
            className="px-8 py-3 rounded-md bg-white text-black dark:bg-black dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors inline-block"
          >
            Sign Up for Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <h2 className="text-2xl font-bold">Launchpad</h2>
              <p className="text-gray-600 dark:text-gray-400">Deploy with confidence</p>
            </div>
            <div className="flex space-x-6">
              <Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">About</Link>
              <Link href="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">Pricing</Link>
              <Link href="/docs" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">Documentation</Link>
              <Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-gray-600 dark:text-gray-400">
            <p> {new Date().getFullYear()} Launchpad. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
