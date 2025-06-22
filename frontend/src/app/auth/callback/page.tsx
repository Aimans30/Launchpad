"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, handleRedirectResult, isAuthenticating } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    async function handleCallback() {
      try {
        console.log('Auth callback page loaded');
        setIsProcessing(true);
        
        // Check if this is a GitHub OAuth callback (has code parameter)
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        console.log('URL parameters:', { 
          code: code ? 'present' : 'absent', 
          state: state ? 'present' : 'absent',
          inProgress: sessionStorage.getItem('github_auth_in_progress')
        });
        
        // Handle standard token-based callback from backend
        const token = searchParams.get("token");
        const errorParam = searchParams.get("error");
        const errorMessage = searchParams.get("message");
        
        // Handle error parameters
        if (errorParam) {
          console.error(`Auth error from URL parameters: ${errorParam}`);
          throw new Error(errorMessage || `Authentication error: ${errorParam}`);
        }
        
        // If this is a GitHub OAuth callback (has code parameter)
        if (code && state) {
          console.log("Processing GitHub OAuth callback with code and state");
          // Process the redirect result using Firebase
          try {
            console.log('Calling handleRedirectResult from callback page');
            await handleRedirectResult();
            console.log('handleRedirectResult completed successfully');
            
            // Force a direct redirect to dashboard
            console.log('Auth callback forcing redirect to dashboard');
            // Set a flag to indicate successful authentication
            localStorage.setItem('auth_success', 'true');
            // Use direct window.location.href for most reliable redirect
            window.location.href = '/dashboard';
            return;
          } catch (githubError: any) {
            console.error("GitHub auth error:", githubError);
            setError(githubError.message || "GitHub authentication failed");
            setIsProcessing(false);
            return;
          }
        }
        
        // Handle direct token-based authentication
        if (token) {
          // Use the login function from AuthContext
          await login(token);
          
          // Redirect to dashboard
          console.log("Authentication successful, redirecting to dashboard");
          window.location.replace("/dashboard");
          return;
        }
        
        // If we get here, we don't have a token or code
        if (!isAuthenticating) {
          throw new Error("No authentication parameters received");
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Authentication failed");
      } finally {
        if (!isAuthenticating) {
          setIsProcessing(false);
        }
      }
    }

    // Execute the callback handler immediately
    handleCallback();
  }, [router, searchParams, login, handleRedirectResult, isAuthenticating]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-black p-8 rounded-lg shadow-md text-center">
        {error ? (
          <>
            <div className="text-red-600 dark:text-red-400 text-xl font-semibold">Authentication Failed</div>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-md"
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <div className="animate-pulse">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">Authenticating...</div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Please wait while we complete your sign in</p>
              <div className="mt-6 flex justify-center">
                <svg className="animate-spin h-10 w-10 text-black dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
