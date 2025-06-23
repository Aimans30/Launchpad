-- Add github_access_token column to users table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    -- Add github_access_token if missing (essential for GitHub API access)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'github_access_token'
    ) THEN
      ALTER TABLE public.users ADD COLUMN github_access_token TEXT;
    END IF;
  END IF;
END $$;
