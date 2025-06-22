require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
if (process.env.NODE_ENV !== 'test') {
  try {
    // Initialize Firebase Admin with service account credentials
    const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
    console.log('Loading Firebase service account from:', serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath)
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.message);
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
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set security headers but allow CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes if they exist
try {
  console.log('Loading auth routes...');
  const authRoutes = require('./routes/auth.routes');
  console.log('Auth routes required successfully');
  
  // Log available routes
  console.log('Available auth routes:');
  authRoutes.stack?.forEach(route => {
    if (route.route) {
      console.log(`${route.route.path} - ${Object.keys(route.route.methods).join(', ')}`);
    }
  });
  
  app.use('/api/auth', authRoutes);
  console.log('Auth routes mounted at /api/auth');
} catch (error) {
  console.error('Auth routes not loaded:', error.message, error.stack);
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
