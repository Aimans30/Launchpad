import { initializeApp } from 'firebase/app';
import { getAuth, GithubAuthProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence } from 'firebase/auth';

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

// Configure auth to use device language for localization
if (typeof window !== 'undefined') {
  auth.useDeviceLanguage(); 
}

// Create GitHub provider
const githubProvider = new GithubAuthProvider();

// Add scopes to GitHub provider
githubProvider.addScope('user:email');
githubProvider.addScope('repo');

// Set custom parameters for GitHub provider
githubProvider.setCustomParameters({
  // Force re-prompt to ensure we get fresh credentials
  prompt: 'consent',
  // Add additional parameters to help with local development
  allow_signup: 'true'
});

export { 
  app, 
  auth, 
  githubProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken, 
  browserPopupRedirectResolver,
  setPersistence,
  browserLocalPersistence
};
