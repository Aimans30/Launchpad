"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  github_username?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  githubLogin: () => void;
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
      
      // Store token
      localStorage.setItem("auth_token", token);
      
      // Get user data
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
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
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = "/login";
  };

  const githubLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/github`;
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
