"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const token = searchParams.get("token");
        
        if (!token) {
          setError("No authentication token received");
          return;
        }

        // Store the token in localStorage
        localStorage.setItem("auth_token", token);

        // Call the login API to get user data
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Authentication failed");
        }

        const data = await response.json();
        
        // Store user data in localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Redirect to dashboard
        router.push("/dashboard");
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Authentication failed");
      }
    }

    handleCallback();
  }, [router, searchParams]);

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
