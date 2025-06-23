-- Create sites table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sites'
  ) THEN
    CREATE TABLE public.sites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add index on user_id for faster lookups
    CREATE INDEX sites_user_id_idx ON public.sites(user_id);
    
    -- Add comment
    COMMENT ON TABLE public.sites IS 'Stores static sites uploaded by users';
  END IF;
END $$;
