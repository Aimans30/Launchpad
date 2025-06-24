"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/config/firebase';

interface GitHubAuthHelperProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function GitHubAuthHelper({ onSuccess, onError }: GitHubAuthHelperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  // Parse URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      storeGitHubToken(code);
    }
  }, []);

  // Function to store GitHub token
  const storeGitHubToken = async (code: string) => {
    if (!user || !auth.currentUser) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get Firebase token for authentication
      const firebaseToken = await auth.currentUser.getIdToken();
      
      // Store the token using the token controller endpoint
      const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/token/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify({
          code: code // Pass the code to the backend
        })
      });
      
      if (!storeResponse.ok) {
        throw new Error('Failed to store GitHub token');
      }
      
      const storeData = await storeResponse.json();
      
      setSuccess(true);
      if (onSuccess) onSuccess();
      
      // Clean up the URL by removing the code parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, document.title, url.toString());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to store GitHub token';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initiate GitHub auth flow
  const initiateGitHubAuth = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Store a flag indicating we're in the GitHub auth flow
      sessionStorage.setItem('github_auth_in_progress', 'true');
      console.log('Initiating GitHub auth flow');
      
      // Redirect to GitHub OAuth flow
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`;
    } catch (err) {
      sessionStorage.removeItem('github_auth_in_progress');
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate GitHub auth';
      console.error('GitHub auth initiation error:', errorMessage);
      setError(errorMessage);
      if (onError) onError(errorMessage);
      setIsLoading(false);
    }
  };
  
  return (
    <div className="github-auth-helper">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button 
            onClick={initiateGitHubAuth}
            className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Reconnect GitHub'}
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>GitHub connected successfully!</p>
        </div>
      )}
      
      {!success && !error && (
        <button 
          onClick={initiateGitHubAuth}
          className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded flex items-center"
          disabled={isLoading}
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.03-1.61-4.03-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.28-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.57C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {isLoading ? 'Connecting...' : 'Connect GitHub'}
        </button>
      )}
    </div>
  );
}
