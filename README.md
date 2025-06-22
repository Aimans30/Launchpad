# Launchpad

A modern web application deployment platform that allows developers to easily deploy and manage their projects.

## Overview

Launchpad is a full-stack application that provides seamless GitHub integration, allowing users to deploy their web applications with minimal configuration. The platform supports various frameworks and provides real-time deployment status updates.

## Features

- **GitHub OAuth Integration**: Secure authentication using GitHub credentials
- **Project Management**: Create, deploy, and manage multiple web projects
- **Real-time Deployment Status**: Monitor the status of your deployments in real-time
- **Framework Support**: Deploy applications built with popular frameworks like Next.js, React, Astro, and more
- **User Dashboard**: Comprehensive dashboard to view all your projects and deployments

## Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Express
- Supabase (PostgreSQL)
- Firebase Authentication

## Architecture

Launchpad uses a modern architecture with:

1. **Frontend**: Next.js application that provides the user interface
2. **Backend API**: Express server that handles authentication, project management, and deployment
3. **Database**: Supabase (PostgreSQL) for storing user data and project information
4. **Authentication**: Firebase for handling user authentication with GitHub OAuth

## Authentication Flow

1. User clicks "Sign in with GitHub" on the frontend
2. Frontend calls backend's `/api/auth/github` endpoint
3. Backend redirects to GitHub OAuth authorization page with Firebase's callback URL
4. After GitHub authorization, user is redirected to Firebase's auth handler
5. Firebase handles the OAuth callback and creates a session
6. Frontend handles the authentication state via Firebase SDK
7. User data is stored and synchronized with Supabase

## Setup Instructions

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Firebase account
- GitHub OAuth application
- Supabase account

### Environment Variables

#### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

#### Backend (.env)
```
PORT=3001
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
CALLBACK_URL=https://your-firebase-app.firebaseapp.com/__/auth/handler
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
FIREBASE_PROJECT_ID=your_firebase_project_id
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/launchpad.git
cd launchpad
```

2. Install dependencies for both frontend and backend
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. Set up environment variables
   - Create `.env.local` in the frontend directory
   - Create `.env` in the backend directory
   - Add the required environment variables as listed above

4. Set up the database
```bash
cd backend
node scripts/setup-database.js
```

5. Start the development servers
```bash
# Start backend server
cd backend
npm run dev

# Start frontend server in a new terminal
cd frontend
npm run dev
```

6. Open your browser and navigate to `http://localhost:3000`

## Deployment

### Frontend
The frontend can be deployed to Vercel, Netlify, or any other Next.js-compatible hosting service.

### Backend
The backend can be deployed to services like Heroku, Railway, or any other Node.js-compatible hosting service.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Firebase](https://firebase.google.com/) for authentication
- [Supabase](https://supabase.io/) for database
- [GitHub](https://github.com/) for OAuth integration
- [Next.js](https://nextjs.org/) for the frontend framework
- [Express](https://expressjs.com/) for the backend framework
