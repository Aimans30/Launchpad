require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkTables() {
  console.log('Checking database tables...');

  try {
    // Check if sites table exists
    const { data: sitesInfo, error: sitesError } = await supabase
      .from('sites')
      .select('count')
      .limit(1);

    if (sitesError) {
      console.error('Error checking sites table:', sitesError);
      console.log('Creating sites table...');
      await createSitesTable();
    } else {
      console.log('✅ Sites table exists');
    }

    // Check if deployments table exists
    const { data: deploymentsInfo, error: deploymentsError } = await supabase
      .from('deployments')
      .select('count')
      .limit(1);

    if (deploymentsError) {
      console.error('Error checking deployments table:', deploymentsError);
      console.log('Creating deployments table...');
      await createDeploymentsTable();
    } else {
      console.log('✅ Deployments table exists');
    }

    // Check if storage bucket exists
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('Error checking storage buckets:', bucketsError);
    } else {
      const publicBucket = buckets.find(bucket => bucket.name === 'public');
      if (!publicBucket) {
        console.log('Creating public storage bucket...');
        await createPublicBucket();
      } else {
        console.log('✅ Public storage bucket exists');
      }
    }

    console.log('Database check completed');
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

async function createSitesTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.sites (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        site_url TEXT,
        status TEXT DEFAULT 'draft',
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `
  });

  if (error) {
    console.error('Error creating sites table:', error);
  } else {
    console.log('✅ Sites table created successfully');
  }
}

async function createDeploymentsTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.deployments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        site_id UUID REFERENCES public.sites(id),
        project_id UUID,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'deploying',
        deployed_url TEXT,
        deployed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `
  });

  if (error) {
    console.error('Error creating deployments table:', error);
  } else {
    console.log('✅ Deployments table created successfully');
  }
}

async function createPublicBucket() {
  const { data, error } = await supabase
    .storage
    .createBucket('public', {
      public: true,
      allowedMimeTypes: ['*/*'],
      fileSizeLimit: 50000000 // 50MB
    });

  if (error) {
    console.error('Error creating public bucket:', error);
  } else {
    console.log('✅ Public bucket created successfully');
  }
}

// Run the check
checkTables(); 