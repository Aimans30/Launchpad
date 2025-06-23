-- Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  github_repo_url VARCHAR(255),
  github_repo_id VARCHAR(255),
  github_username VARCHAR(255),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);

-- Add row level security policies for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to select only their own projects
DROP POLICY IF EXISTS projects_select_policy ON projects;
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy to allow users to insert their own projects
DROP POLICY IF EXISTS projects_insert_policy ON projects;
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy to allow users to update only their own projects
DROP POLICY IF EXISTS projects_update_policy ON projects;
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy to allow users to delete only their own projects
DROP POLICY IF EXISTS projects_delete_policy ON projects;
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  USING (user_id = auth.uid());

-- Create deployments table if it doesn't exist
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  version VARCHAR(50),
  deployment_url VARCHAR(255),
  environment VARCHAR(50) DEFAULT 'production',
  commit_hash VARCHAR(100),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS deployments_project_id_idx ON deployments(project_id);
CREATE INDEX IF NOT EXISTS deployments_user_id_idx ON deployments(user_id);
CREATE INDEX IF NOT EXISTS deployments_site_id_idx ON deployments(site_id);

-- Add row level security policies for deployments
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to select only their own deployments
DROP POLICY IF EXISTS deployments_select_policy ON deployments;
CREATE POLICY deployments_select_policy ON deployments
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy to allow users to insert their own deployments
DROP POLICY IF EXISTS deployments_insert_policy ON deployments;
CREATE POLICY deployments_insert_policy ON deployments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy to allow users to update only their own deployments
DROP POLICY IF EXISTS deployments_update_policy ON deployments;
CREATE POLICY deployments_update_policy ON deployments
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy to allow users to delete only their own deployments
DROP POLICY IF EXISTS deployments_delete_policy ON deployments;
CREATE POLICY deployments_delete_policy ON deployments
  FOR DELETE
  USING (user_id = auth.uid());
