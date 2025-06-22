"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // Clear any existing session storage to prevent conflicts
    try {
      // Only clear auth-related items, not everything
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("firebase:authUser");
    } catch (e) {
      console.warn("Could not clear storage", e);
    }

    async function handleCallback() {
      try {
        setIsProcessing(true);
        const token = searchParams.get("token");
        const errorParam = searchParams.get("error");
        const errorMessage = searchParams.get("message");
        
        if (errorParam) {
          throw new Error(errorMessage || `Authentication error: ${errorParam}`);
        }
        
        if (!token) {
          throw new Error("No authentication token received");
        }

        // Use the login function from AuthContext
        await login(token);
        
        // Redirect to dashboard
        console.log("Authentication successful, redirecting to dashboard");
        router.push("/dashboard");
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Authentication failed");
      } finally {
        setIsProcessing(false);
      }
    }

    // Small delay to ensure browser has time to initialize storage
    const timeoutId = setTimeout(() => {
      handleCallback();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [router, searchParams, login]);

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
