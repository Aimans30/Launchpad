"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, githubProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver, signInWithRedirect, getRedirectResult } from "@/config/firebase";
import { GithubAuthProvider } from "firebase/auth";
import { User as FirebaseUser } from "firebase/auth";

// Function to fetch GitHub user info using the access token
async function fetchGitHubUserInfo(accessToken: string | null) {
  if (!accessToken) return null;
  
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch GitHub user info:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('GitHub API user data retrieved successfully');
    return data;
  } catch (error) {
    console.error('Error fetching GitHub user info:', error);
    return null;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  github_username?: string;
  github_id?: string;
  avatar_url?: string;
  firebase_uid?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  githubLogin: () => Promise<void>;
  handleRedirectResult: () => Promise<void>;
  isAuthenticating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Check if user is already logged in or returning from a redirect
    const checkAuthAndHandleRedirect = async () => {
      try {
        // First check if we're returning from a GitHub auth redirect
        if (sessionStorage.getItem('github_auth_in_progress')) {
          try {
            await handleRedirectResult();
            // If handleRedirectResult completes successfully, the user should be logged in
            // No need to continue with token verification
            return;
          } catch (redirectError) {
            console.error('Error handling redirect result:', redirectError);
            // Clear the in-progress flag
            sessionStorage.removeItem('github_auth_in_progress');
            // Continue with normal auth check
          }
        }
        
        // Normal authentication check
        const token = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("user");

        if (!token || !storedUser) {
          setIsLoading(false);
          return;
        }

        // Verify token is still valid
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/verify-token`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Token is invalid, clear storage
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user");
          setIsLoading(false);
          return;
        }

        // Token is valid, set user
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoading(false);
      }
    };

    checkAuthAndHandleRedirect();
  }, []);

  const login = async (token: string) => {
    try {
      setIsLoading(true);
      
      // Sign in with custom token
      const userCredential = await signInWithCustomToken(auth, token);
      const user = userCredential.user;
      
      if (!user) {
        throw new Error("Failed to authenticate with token");
      }
      
      // Get the ID token
      const idToken = await user.getIdToken();
      
      // Get user data from backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/auth/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        // If we can't get user data, try to extract basic info from Firebase user
        console.warn(`Failed to get user data from backend: ${response.status}`);
        
        // Create minimal user object from Firebase user
        const minimalUser = {
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          avatar_url: user.photoURL,
          created_at: new Date().toISOString()
        };
        
        // Store minimal user data
        localStorage.setItem("user", JSON.stringify(minimalUser));
        localStorage.setItem("auth_token", idToken);
        setUser(minimalUser as User);
        setIsAuthenticated(true);
        return;
      }
      
      const data = await response.json();
      
      // Store user data and auth token in localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("auth_token", idToken);
      setUser(data.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Sign out from Firebase
      await auth.signOut();
      
      // Clear local storage
      localStorage.removeItem("user");
      
      // Update state
      setUser(null);
      setIsAuthenticated(false);
      
      // Redirect to login page
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const githubLogin = async () => {
    try {
      console.log('Starting GitHub login process...');
      setIsLoading(true);
      setIsAuthenticating(true);
      
      // Store a flag in sessionStorage to indicate we're in the middle of GitHub auth
      // This will be used by the login page to show a loading state
      sessionStorage.setItem('github_auth_in_progress', 'true');
      console.log('Set github_auth_in_progress flag in sessionStorage');
      
      // Use redirect-based authentication instead of popup
      // This helps hide the sensitive Firebase URL parameters
      console.log('Initiating signInWithRedirect with GitHub provider...');
      await signInWithRedirect(auth, githubProvider);
      
      // The page will redirect to GitHub and then back to our app
      // The rest of this function won't execute until after the redirect
      console.log('Redirect initiated - this message should not appear');
      return;
    } catch (error) {
      console.error('GitHub login redirect error:', error);
      setIsLoading(false);
      sessionStorage.removeItem('github_auth_in_progress');
      throw error;
    }
  };
  
  // This function will be called after returning from the GitHub redirect
  const handleRedirectResult = async () => {
    try {
      console.log('handleRedirectResult called');
      
      // Check if we're returning from a GitHub auth redirect
      const inProgress = sessionStorage.getItem('github_auth_in_progress');
      console.log('github_auth_in_progress flag:', inProgress);
      
      if (!inProgress) {
        console.log('Not returning from GitHub auth, exiting handleRedirectResult');
        return;
      }
      
      console.log('Setting loading state...');
      setIsLoading(true);
      
      // Get the result of the redirect
      console.log('Getting redirect result from Firebase auth...');
      const result = await getRedirectResult(auth);
      console.log('Redirect result received:', result ? 'success' : 'null');
      
      // Clear the in-progress flag
      sessionStorage.removeItem('github_auth_in_progress');
      console.log('Cleared github_auth_in_progress flag');
      
      // If no result, the user probably cancelled
      if (!result) {
        console.log('No redirect result, user probably cancelled');
        setIsLoading(false);
        return;
      }
      
      console.log('Successfully got redirect result from Firebase');
      
      // This gives you a GitHub Access Token
      const credential = GithubAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      
      // The signed-in user info
      const firebaseUser = result.user;
      
      if (!firebaseUser) {
        setIsLoading(false);
        throw new Error("Failed to authenticate with GitHub");
      }
      
      // Get the ID token from Firebase
      const idToken = await firebaseUser.getIdToken();
      
      // Get additional GitHub user info from the result if available
      const githubUser = accessToken ? await fetchGitHubUserInfo(accessToken) : null;

      try {
        // Get user data from our backend
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        
        const response = await fetch(`${apiUrl}/api/auth/user`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get user data: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        // Enhance user data with GitHub info if available
        if (githubUser && data.user) {
          // Always use GitHub data for these fields to ensure fresh data
          if (githubUser.avatar_url) {
            data.user.avatar_url = githubUser.avatar_url;
          }
          if (githubUser.name) {
            data.user.name = githubUser.name;
          }
          if (githubUser.login) {
            data.user.github_username = githubUser.login;
          }
        }
        
        // Store user data and auth token in localStorage
        console.log('Storing user data and auth token in localStorage');
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("auth_token", idToken); // Store the Firebase ID token
        console.log('Setting user state and isAuthenticated=true');
        setUser(data.user);
        setIsAuthenticated(true);
        
        // Always redirect to dashboard after successful authentication
        console.log('About to redirect to dashboard...');
        // Set a flag to indicate successful authentication
        localStorage.setItem('auth_success', 'true');
        // Use direct window.location.href for most reliable redirect
        console.log('Executing redirect to dashboard now');
        // Delay slightly to ensure localStorage is set
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } catch (error) {
        console.error('Error fetching user data after GitHub auth:', error);
        // Clear any partial authentication state
        await auth.signOut();
        localStorage.removeItem("user");
        localStorage.removeItem("auth_token");
      } finally {
        setIsLoading(false);
        setIsAuthenticating(false);
      }
    } catch (error) {
      console.error("GitHub login error:", error);
      setIsLoading(false);
      setIsAuthenticating(false);
      // Clear any partial authentication state
      sessionStorage.removeItem('github_auth_in_progress');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      login,
      logout,
      githubLogin,
      handleRedirectResult,
      isAuthenticating
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
