-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  site_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);

-- Add RLS (Row Level Security) policies
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own sites
CREATE POLICY sites_select_policy ON sites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own sites
CREATE POLICY sites_insert_policy ON sites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own sites
CREATE POLICY sites_update_policy ON sites
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for users to delete their own sites
CREATE POLICY sites_delete_policy ON sites
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON sites TO authenticated;
