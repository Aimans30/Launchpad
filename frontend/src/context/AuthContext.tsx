"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, githubProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence } from "@/config/firebase";
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
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  githubLogin: () => Promise<void>;
  handleRedirectResult: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
      console.log('Starting GitHub login process');
      setIsAuthenticating(true);
      
      // Clear any previous auth data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('auth_success');
      
      // Ensure Firebase will use local persistence
      console.log('Setting Firebase persistence to local');
      await setPersistence(auth, browserLocalPersistence);
      
      // For local development, use popup authentication instead of redirect
      // This avoids issues with redirect URLs in local environments
      console.log('Initiating GitHub OAuth with popup');
      const result = await signInWithPopup(auth, githubProvider);
      console.log('GitHub login successful:', result.user?.email);
      
      // Get the GitHub access token
      const credential = GithubAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      const token = await result.user.getIdToken();
      
      // Store the Firebase token
      localStorage.setItem('auth_token', token);
      
      // Create initial user object
      let userObj: User = {
        id: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || 'GitHub User',
        avatar_url: result.user.photoURL || '',
        github_username: '',
        github_id: '',
        firebase_uid: result.user.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // If we have an access token, fetch GitHub user info to get the correct username
      if (accessToken) {
        try {
          console.log('Fetching GitHub user info with access token');
          const githubResponse = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
          });
          
          if (githubResponse.ok) {
            const githubData = await githubResponse.json();
            console.log('GitHub user data retrieved:', githubData.login);
            
            // Update user object with GitHub data
            userObj = {
              ...userObj,
              github_username: githubData.login,
              github_id: githubData.id?.toString(),
              avatar_url: githubData.avatar_url || userObj.avatar_url
            };
            
            // Send user data to backend to store in Supabase
            try {
              console.log('Sending GitHub user data to backend...');
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
              const apiEndpoint = `${apiUrl}/api/auth/user`;
              
              console.log('API endpoint:', apiEndpoint);
              console.log('Firebase token length:', token.length);
              console.log('GitHub username:', githubData.login);
              console.log('GitHub ID:', githubData.id);
              
              // Use POST to explicitly send GitHub user data to the backend
              // This ensures the correct GitHub username is stored in Supabase
              const userResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  firebaseUid: result.user.uid,
                  githubId: githubData.id,
                  githubUsername: githubData.login,
                  email: result.user.email,
                  displayName: githubData.name || result.user.displayName,
                  photoURL: githubData.avatar_url || result.user.photoURL
                })
              });
              
              console.log('API response status:', userResponse.status);
              
              if (userResponse.ok) {
                const userData = await userResponse.json();
                console.log('User data from backend:', userData);
                if (userData.user) {
                  console.log('Received user data with github_username:', userData.user.github_username);
                  // Update our user object with the data from the backend
                  userObj = userData.user;
                } else {
                  console.log('No user data in response, using local user object');
                  // If the backend doesn't return user data, ensure we at least have the GitHub username
                  userObj = {
                    ...userObj,
                    github_username: githubData.login,
                    github_id: githubData.id?.toString()
                  };
                }
              } else {
                const errorText = await userResponse.text();
                console.error(`Failed to get user data from backend: Status ${userResponse.status}`, errorText);
                // Fallback to using the GitHub data we already have
                userObj = {
                  ...userObj,
                  github_username: githubData.login,
                  github_id: githubData.id?.toString()
                };
              }
            } catch (apiError) {
              console.error('API error during user data fetch:', apiError);
              // Fallback to using the GitHub data we already have
              userObj = {
                ...userObj,
                github_username: githubData.login,
                github_id: githubData.id?.toString()
              };
            }
          } else {
            console.error('Failed to fetch GitHub user data:', await githubResponse.text());
          }
        } catch (githubError) {
          console.error('Error fetching GitHub user data:', githubError);
        }
      }
      
      localStorage.setItem('user', JSON.stringify(userObj));
      localStorage.setItem('auth_success', 'true');
      
      setUser(userObj);
      setIsAuthenticated(true);
      setIsAuthenticating(false);
      
      // Redirect to dashboard
      window.location.replace('/dashboard');
      return;
    } catch (error) {
      console.error('GitHub login redirect error:', error);
      setIsLoading(false);
      setIsAuthenticating(false);
      
      // Clear auth tracking flags
      sessionStorage.removeItem('github_auth_in_progress');
      sessionStorage.removeItem('github_auth_timestamp');
      sessionStorage.removeItem('github_auth_state');
      sessionStorage.removeItem('github_auth_retry_count');
      
      throw error;
    }
  };

  const handleRedirectResult = async () => {
    console.log('handleRedirectResult called');
    
    try {
      // Check if we're in the process of a GitHub auth
      const githubAuthInProgress = sessionStorage.getItem('github_auth_in_progress');
      
      if (!githubAuthInProgress) {
        console.log('No GitHub auth in progress, skipping redirect handling');
        return;
      }
      
      console.log('GitHub auth in progress, handling redirect result');
      setIsAuthenticating(true);
      
      // Check if the user is already authenticated with Firebase
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('User is already authenticated with Firebase:', currentUser.email);
        // Use the current user instead of waiting for redirect result
        // This handles the case where the redirect already happened but we missed it
        const token = await currentUser.getIdToken();
        const userObj: User = {
          email: currentUser.email || 'no-email@example.com', // Provide fallback values for required fields
          id: currentUser.uid,
          name: currentUser.displayName || 'GitHub User',
          avatar_url: currentUser.photoURL || '',
          github_username: currentUser.displayName?.toLowerCase() || 'github-user',
          firebase_uid: currentUser.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Store auth data and set success flag
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('auth_success', 'true');
        
        // Clear the in-progress flag
        sessionStorage.removeItem('github_auth_in_progress');
        sessionStorage.removeItem('github_auth_retry_count');
        
        setUser(userObj);
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        console.log('Authentication successful via current user, redirecting to dashboard');
        window.location.replace('/dashboard');
        return;
      }
      
      // Try to get the redirect result
      let result = null;
      try {
        result = await getRedirectResult(auth);
        console.log('Redirect result:', result ? `Available for: ${result.user.email}` : 'No result');
      } catch (error) {
        console.error('Error getting redirect result:', error);
      }
      
      // If no result, try a few more times with a delay
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!result && retryCount < maxRetries) {
        retryCount++;
        console.log(`No redirect result yet, retry ${retryCount}/${maxRetries}`);
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        try {
          result = await getRedirectResult(auth);
          if (result) {
            console.log(`Got result on retry ${retryCount}:`, result.user.email);
          }
        } catch (error) {
          console.error(`Error getting redirect result on retry ${retryCount}:`, error);
        }
      }
      
      // If we still don't have a result, check if Firebase user exists anyway
      if (!result) {
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          console.log('No redirect result but found Firebase user:', firebaseUser.email);
          const token = await firebaseUser.getIdToken();
          const userObj: User = {
            email: firebaseUser.email || 'no-email@example.com',
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'GitHub User',
            avatar_url: firebaseUser.photoURL || '',
            github_username: firebaseUser.displayName?.toLowerCase() || 'github-user',
            firebase_uid: firebaseUser.uid,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          localStorage.setItem('auth_token', token);
          localStorage.setItem('user', JSON.stringify(userObj));
          localStorage.setItem('auth_success', 'true');
          
          sessionStorage.removeItem('github_auth_in_progress');
          sessionStorage.removeItem('github_auth_retry_count');
          
          setUser(userObj);
          setIsAuthenticated(true);
          setIsAuthenticating(false);
          console.log('Authentication successful via Firebase user, redirecting to dashboard');
          window.location.replace('/dashboard');
          return;
        } else {
          console.log('No redirect result and no Firebase user');
          sessionStorage.removeItem('github_auth_in_progress');
          sessionStorage.removeItem('github_auth_retry_count');
          setAuthError('GitHub authentication was not completed. Please try again.');
          setIsAuthenticating(false);
          return;
        }
      }
      
      // If we reach here, we have a successful GitHub login result
      console.log('User authenticated with GitHub:', result.user.email);
      
      // Get Firebase ID token
      const firebaseToken = await result.user.getIdToken(true); 
      console.log('Got fresh Firebase ID token');
      
      // Get the GitHub credentials from the user
      const credential = GithubAuthProvider.credentialFromResult(result);
      const githubToken = credential?.accessToken;
      
      if (!githubToken) {
        console.error('No GitHub token found in credentials');
        throw new Error('Failed to get GitHub access token');
      }
      
      console.log('Got GitHub access token successfully');
      
      try {
        // Fetch GitHub user info
        console.log('Fetching GitHub user info...');
        const githubUserResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `token ${githubToken}`,
          },
        });
        
        if (!githubUserResponse.ok) {
          throw new Error(`GitHub API error: ${githubUserResponse.status}`);
        }
        
        const githubUserData = await githubUserResponse.json();
        console.log('GitHub user data:', githubUserData.login);
        
        // Fetch user from backend or create if doesn't exist
        console.log('Sending user data to backend...');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const userResponse = await fetch(`${apiUrl}/api/auth/user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${firebaseToken}`,
          },
          body: JSON.stringify({
            firebaseUid: result.user.uid,
            githubId: githubUserData.id,
            email: result.user.email,
            githubUsername: githubUserData.login,
            displayName: githubUserData.name || result.user.displayName,
            photoURL: githubUserData.avatar_url || result.user.photoURL,
          }),
        });
        
        if (!userResponse.ok) {
          throw new Error(`API error: ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();
        console.log('User data fetched/created in backend:', userData.id);
        
        // Store user data in localStorage for persistence
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Update user state in context
        setUser(userData);
        setIsAuthenticated(true);
        
      } catch (apiError) {
        console.error('API error during authentication:', apiError);
        
        // If the backend call fails, create a minimal user object from Firebase
        const fallbackUser = {
          id: result.user.uid,
          email: result.user.email || '',
          name: result.user.displayName || 'GitHub User',
          photoURL: result.user.photoURL || '',
          github_username: result.user.providerData[0]?.displayName || '',
          created_at: new Date().toISOString(),
          firebase_uid: result.user.uid
        } as User;
        
        console.log('Created fallback user from Firebase data:', fallbackUser);
        localStorage.setItem('user', JSON.stringify(fallbackUser));
        setUser(fallbackUser);
        setIsAuthenticated(true);
      }
      
      // Set flag to indicate successful auth and store auth time
      console.log('Setting auth_success flag and timestamp');
      localStorage.setItem('auth_success', 'true');
      localStorage.setItem('auth_timestamp', Date.now().toString());
      
      // Clear GitHub auth in progress flags
      sessionStorage.removeItem('github_auth_in_progress');
      sessionStorage.removeItem('github_auth_timestamp');
      sessionStorage.removeItem('github_auth_state');
      sessionStorage.removeItem('github_auth_retry_count');
      
      // Force redirect to dashboard with a hard redirect
      console.log('Redirecting to dashboard');
      window.location.href = '/dashboard';
      
    } catch (error) {
      console.error('Error handling redirect result:', error);
      
      // Clear all auth flags and state on error
      sessionStorage.removeItem('github_auth_in_progress');
      sessionStorage.removeItem('github_auth_timestamp');
      sessionStorage.removeItem('github_auth_state');
      sessionStorage.removeItem('github_auth_retry_count');
      
      localStorage.removeItem('auth_success');
      setAuthError('Failed to authenticate with GitHub. Please try again.');
    } finally {
      setIsLoading(false);
      setIsAuthenticating(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isAuthenticating,
        authError,
        login,
        logout,
        githubLogin,
        handleRedirectResult
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
