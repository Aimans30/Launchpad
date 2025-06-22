"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, githubProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver } from "@/config/firebase";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("user");

        if (!token || !storedUser) {
          setIsLoading(false);
          return;
        }

        // Verify token is still valid
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/verify`, {
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

    checkAuth();
  }, []);

  const login = async (token: string) => {
    try {
      setIsLoading(true);
      
      // Sign in with Firebase using the custom token
      await signInWithCustomToken(auth, token);
      
      // Get the current Firebase user
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("Failed to authenticate with Firebase");
      }
      
      // Get user data from our backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/user`, {
        headers: {
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get user data");
      }

      const data = await response.json();
      
      // Store user data
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Login error:", error);
      // Clear any partial data
      localStorage.removeItem("user");
      // Sign out from Firebase
      await auth.signOut();
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
      setIsLoading(true);
      console.log('Starting GitHub login process');
      
      // Use Firebase's GitHub authentication with popup and explicit resolver
      console.log('Opening GitHub auth popup');
      const result = await signInWithPopup(auth, githubProvider, browserPopupRedirectResolver);
      console.log('Popup authentication completed');
      
      // This gives you a GitHub Access Token
      const credential = GithubAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      console.log('Got GitHub credential:', credential ? 'success' : 'null');
      console.log('Access token available:', accessToken ? 'yes' : 'no');
      
      // The signed-in user info
      const firebaseUser = result.user;
      console.log('Firebase user:', firebaseUser ? firebaseUser.uid : 'null');
      
      if (!firebaseUser) {
        throw new Error("Failed to authenticate with GitHub");
      }
      
      // Get the ID token from Firebase
      console.log('Getting Firebase ID token');
      const idToken = await firebaseUser.getIdToken();
      console.log('Got ID token, length:', idToken?.length);
      
      // Get additional GitHub user info from the result if available
      const githubUser = accessToken ? await fetchGitHubUserInfo(accessToken) : null;
      
      console.log('GitHub user info:', githubUser ? 'Retrieved' : 'Not available');
      
      // Get user data from our backend
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}`;
      console.log('API URL:', apiUrl);
      
      console.log('Fetching user data from backend');
      const response = await fetch(`${apiUrl}/api/auth/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log('Backend response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`Failed to get user data: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('User data received from backend:', data.user);
      
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
        console.log('Enhanced user data with GitHub info:', {
          name: data.user.name,
          github_username: data.user.github_username,
          avatar_url: data.user.avatar_url ? 'Present' : 'Not present'
        });
      }
      
      // Store user data in localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      
      // Redirect to dashboard
      console.log('Login successful, redirecting to dashboard');
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("GitHub login error:", error);
      // Sign out from Firebase
      await auth.signOut();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        logout,
        githubLogin,
      }}
    >
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
