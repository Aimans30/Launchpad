-- Create a function to add github_access_token column if it doesn't exist
CREATE OR REPLACE FUNCTION public.add_github_token_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'github_access_token'
  ) THEN
    -- Add the column if it doesn't exist
    EXECUTE 'ALTER TABLE public.users ADD COLUMN github_access_token TEXT';
    RAISE NOTICE 'Added github_access_token column to users table';
  ELSE
    RAISE NOTICE 'github_access_token column already exists';
  END IF;
END;
$$;
