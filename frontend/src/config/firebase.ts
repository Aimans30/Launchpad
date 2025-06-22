import { initializeApp } from 'firebase/app';
import { getAuth, GithubAuthProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCcjBH32zTfizNfIuGQV6brjvUlDxsPDCo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "launchpad-4a4ac.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "launchpad-4a4ac",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "launchpad-4a4ac.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "662705029012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:662705029012:web:81ae4902b063c0cc579981",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-0K00PE4Z53"
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
  redirect_uri: 'https://launchpad-4a4ac.firebaseapp.com/__/auth/handler'
});

export { app, auth, githubProvider, signInWithPopup, signInWithCustomToken, browserPopupRedirectResolver };
