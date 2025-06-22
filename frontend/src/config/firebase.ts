import { initializeApp } from 'firebase/app';
import { getAuth, GithubAuthProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const githubProvider = new GithubAuthProvider();

// Add scopes to GitHub provider
githubProvider.addScope('user:email');
githubProvider.addScope('repo');

// Set custom parameters for GitHub provider
githubProvider.setCustomParameters({
  // Force re-prompt to ensure we get fresh credentials
  prompt: 'consent',
  // Use the correct redirect URI that's registered with GitHub
  redirect_uri: process.env.NEXT_PUBLIC_FIREBASE_REDIRECT_URI || ''
});

export { app, auth, githubProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver };
