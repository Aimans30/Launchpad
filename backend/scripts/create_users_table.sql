-- Drop existing users table if it exists but doesn't have the right columns
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'firebase_uid'
  ) THEN
    DROP TABLE public.users;
  END IF;
END $$;

-- Create users table with all required columns for GitHub OAuth integration
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  firebase_uid TEXT UNIQUE,
  github_id TEXT,
  github_username TEXT,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON public.users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON public.users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Add missing columns if table exists but is missing columns
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    -- Add firebase_uid if missing (essential for Firebase authentication)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'firebase_uid'
    ) THEN
      ALTER TABLE public.users ADD COLUMN firebase_uid TEXT UNIQUE;
    END IF;
    
    -- Add github_id if missing (essential for GitHub OAuth)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'github_id'
    ) THEN
      ALTER TABLE public.users ADD COLUMN github_id TEXT;
    END IF;
    
    -- Add github_username if missing (for display purposes)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'github_username'
    ) THEN
      ALTER TABLE public.users ADD COLUMN github_username TEXT;
    END IF;
    
    -- Add avatar_url if missing (for GitHub profile picture)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'avatar_url'
    ) THEN
      ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
    END IF;
  END IF;
END $$;
