"use client";

import { useState, useEffect } from 'react';
import { auth } from "@/config/firebase";

export default function AuthCheck() {
  const [authStatus, setAuthStatus] = useState<{
    firebaseUser: boolean;
    storedToken: boolean;
    storedUser: boolean;
    tokenValid: boolean;
  }>({
    firebaseUser: false,
    storedToken: false,
    storedUser: false,
    tokenValid: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check Firebase user
        const firebaseUser = auth.currentUser;
        
        // Check localStorage
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user');
        
        // Check if token is valid
        let tokenValid = false;
        if (storedToken) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-token`, {
              headers: {
                Authorization: `Bearer ${storedToken}`
              }
            });
            tokenValid = response.ok;
          } catch (err) {
            console.error('Error verifying token:', err);
          }
        }
        
        setAuthStatus({
          firebaseUser: !!firebaseUser,
          storedToken: !!storedToken,
          storedUser: !!storedUser,
          tokenValid
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isLoading) {
    return <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">Checking authentication status...</div>;
  }
  
  if (error) {
    return <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">Error: {error}</div>;
  }
  
  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-medium mb-2">Authentication Status</h3>
      <ul className="space-y-1">
        <li className="flex items-center">
          <span className={`w-4 h-4 rounded-full mr-2 ${authStatus.firebaseUser ? 'bg-green-500' : 'bg-red-500'}`}></span>
          Firebase User: {authStatus.firebaseUser ? 'Logged In' : 'Not Logged In'}
        </li>
        <li className="flex items-center">
          <span className={`w-4 h-4 rounded-full mr-2 ${authStatus.storedToken ? 'bg-green-500' : 'bg-red-500'}`}></span>
          Stored Token: {authStatus.storedToken ? 'Present' : 'Missing'}
        </li>
        <li className="flex items-center">
          <span className={`w-4 h-4 rounded-full mr-2 ${authStatus.storedUser ? 'bg-green-500' : 'bg-red-500'}`}></span>
          Stored User: {authStatus.storedUser ? 'Present' : 'Missing'}
        </li>
        <li className="flex items-center">
          <span className={`w-4 h-4 rounded-full mr-2 ${authStatus.tokenValid ? 'bg-green-500' : 'bg-red-500'}`}></span>
          Token Valid: {authStatus.tokenValid ? 'Yes' : 'No'}
        </li>
      </ul>
      
      <div className="mt-4">
        <button 
          onClick={() => window.location.href = '/login'} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
} 