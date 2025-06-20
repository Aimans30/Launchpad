require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const firebase = require('firebase/app');
require('firebase/auth');

if (process.env.NODE_ENV !== 'test') {
  try {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
  }
}

// Initialize Supabase Client
let supabase;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    console.log('Supabase initialized successfully');
  } else {
    console.log('Supabase initialization skipped - missing environment variables');
  }
} catch (error) {
  console.error('Supabase initialization error:', error.message);
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes if they exist
try {
  const authRoutes = require('./routes/auth.routes');
  app.use('/api/auth', authRoutes);
  console.log('Auth routes loaded');
} catch (error) {
  console.log('Auth routes not loaded:', error.message);
}

try {
  const deploymentRoutes = require('./routes/deployment.routes');
  app.use('/api/deployments', deploymentRoutes);
  console.log('Deployment routes loaded');
} catch (error) {
  console.log('Deployment routes not loaded:', error.message);
}

try {
  const projectRoutes = require('./routes/project.routes');
  app.use('/api/projects', projectRoutes);
  console.log('Project routes loaded');
} catch (error) {
  console.log('Project routes not loaded:', error.message);
}

try {
  const githubRoutes = require('./routes/github.routes');
  app.use('/api/github', githubRoutes);
  console.log('GitHub routes loaded');
} catch (error) {
  console.log('GitHub routes not loaded:', error.message);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
