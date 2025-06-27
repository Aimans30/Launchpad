require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client with service key for admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Must use service key for schema modifications
);

async function createSitesTable() {
  try {
    console.log('Checking Supabase connection...');
    // Test connection
    const { data: connectionTest, error: connectionError } = await supabase.from('_dummy_query').select('*').limit(1);
    if (connectionError && connectionError.code !== 'PGRST204') {
      console.error('Error connecting to Supabase:', connectionError);
      return;
    }
    console.log('Connected to Supabase successfully');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../migrations/sites_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing sites table migration...');
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Error executing migration:', error);
      
      // Alternative approach: try to execute SQL directly
      console.log('Trying alternative approach to create sites table...');
      
      // Execute each statement separately
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const statement of statements) {
        console.log(`Executing statement: ${statement.substring(0, 50)}...`);
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
        if (stmtError) {
          console.error(`Error executing statement: ${stmtError.message}`);
        }
      }
    } else {
      console.log('Migration executed successfully');
    }

    // Verify the sites table exists with the site_url column
    console.log('Verifying sites table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('sites')
      .select('site_url')
      .limit(1);

    if (tableError) {
      console.error('Error verifying sites table:', tableError);
    } else {
      console.log('Sites table with site_url column verified successfully');
    }

    console.log('Sites table migration completed');
  } catch (error) {
    console.error('Unexpected error during migration:', error);
  }
}

// Run the migration
createSitesTable()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
