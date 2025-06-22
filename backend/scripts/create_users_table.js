require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client with service key for admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Must use service key for schema modifications
);

async function createUsersTable() {
  try {
    console.log('Checking Supabase connection...');
    // Test connection
    const { data: connectionTest, error: connectionError } = await supabase.from('_dummy_query').select('*').limit(1);
    if (connectionError && connectionError.code !== 'PGRST204') {
      console.error('Error connecting to Supabase:', connectionError);
      return;
    }
    console.log('Connected to Supabase successfully');

    // Check if users table exists
    console.log('Checking if users table exists...');
    const { data: tableExists, error: tableCheckError } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact', head: true });

    if (tableCheckError && tableCheckError.code !== 'PGRST204') {
      console.log('Users table does not exist, creating it...');
    } else {
      console.log('Users table exists, checking columns...');
    }

    // Create or modify users table using raw SQL
    console.log('Creating/updating users table with all required columns...');
    
    // First, try to create the table with all columns
    const createTableSQL = `
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
    `;
    
    // Execute create table SQL
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL }).single();
    
    if (createError) {
      console.log('Error creating table:', createError.message);
      console.log('Trying alternative approach...');
      
      // Try to add columns one by one if table exists
      const addColumnsSQL = `
        DO $$ 
        BEGIN
          -- Add firebase_uid if missing
          BEGIN
            ALTER TABLE public.users ADD COLUMN firebase_uid TEXT UNIQUE;
          EXCEPTION WHEN duplicate_column THEN
            RAISE NOTICE 'Column firebase_uid already exists';
          END;
          
          -- Add github_id if missing
          BEGIN
            ALTER TABLE public.users ADD COLUMN github_id TEXT;
          EXCEPTION WHEN duplicate_column THEN
            RAISE NOTICE 'Column github_id already exists';
          END;
          
          -- Add github_username if missing
          BEGIN
            ALTER TABLE public.users ADD COLUMN github_username TEXT;
          EXCEPTION WHEN duplicate_column THEN
            RAISE NOTICE 'Column github_username already exists';
          END;
          
          -- Add avatar_url if missing
          BEGIN
            ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
          EXCEPTION WHEN duplicate_column THEN
            RAISE NOTICE 'Column avatar_url already exists';
          END;
        END $$;
      `;
      
      const { error: alterError } = await supabase.rpc('exec_sql', { sql: addColumnsSQL }).single();
      
      if (alterError) {
        console.error('Failed to add columns:', alterError.message);
        console.log('Please add these columns manually in the Supabase dashboard:');
        console.log('- firebase_uid (text, unique)');
        console.log('- github_id (text)');
        console.log('- github_username (text)');
        console.log('- avatar_url (text)');
      } else {
        console.log('Columns added successfully!');
      }
    } else {
      console.log('Table created or updated successfully!');
    }
    
    // Check current table structure
    console.log('Checking current table structure...');
    const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', { 
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users';"
    });
    
    if (columnsError) {
      console.error('Error checking columns:', columnsError.message);
    } else {
      console.log('Current users table structure:');
      columns.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
    }
    
    console.log('\nSetup complete! You can now restart your backend server.');
    
  } catch (err) {
    console.error('Script error:', err);
    console.log('\nPlease create the users table manually in the Supabase dashboard with these columns:');
    console.log('- id (uuid, primary key)');
    console.log('- firebase_uid (text, unique)');
    console.log('- github_id (text)');
    console.log('- github_username (text)');
    console.log('- name (text)');
    console.log('- email (text)');
    console.log('- avatar_url (text)');
    console.log('- created_at (timestamp with time zone)');
    console.log('- updated_at (timestamp with time zone)');
  }
}

createUsersTable();
