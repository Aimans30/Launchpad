const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Ensure environment variables are loaded

// Get Supabase credentials from environment variables
// IMPORTANT: For storage operations, we need the service key with proper permissions
let supabaseUrl = process.env.SUPABASE_URL;
// Prioritize the service key for admin operations
let supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// If not found, try to load from .env file directly
if (!supabaseUrl || !supabaseKey) {
  console.log('Supabase credentials not found in environment variables, trying to load from .env file...');
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      for (const line of envLines) {
        const [key, value] = line.split('=');
        if (key && value) {
          const trimmedKey = key.trim();
          const trimmedValue = value.trim();
          
          if (trimmedKey === 'SUPABASE_URL' && !supabaseUrl) {
            supabaseUrl = trimmedValue;
            console.log('Loaded SUPABASE_URL from .env file');
          } else if (trimmedKey === 'SUPABASE_SERVICE_KEY' && !supabaseKey) {
            // Prioritize service key
            supabaseKey = trimmedValue;
            console.log('Loaded SUPABASE_SERVICE_KEY from .env file');
          } else if (trimmedKey === 'SUPABASE_KEY' && !supabaseKey) {
            supabaseKey = trimmedValue;
            console.log('Loaded SUPABASE_KEY from .env file');
          } else if (trimmedKey === 'SUPABASE_ANON_KEY' && !supabaseKey) {
            supabaseKey = trimmedValue;
            console.log('Loaded SUPABASE_ANON_KEY from .env file');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

// Log Supabase configuration
console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl}` : 'Not set');

// Determine which key we're using
let keyType = 'Unknown';
if (supabaseKey === process.env.SUPABASE_SERVICE_KEY) keyType = 'SERVICE_KEY';
else if (supabaseKey === process.env.SUPABASE_KEY) keyType = 'KEY';
else if (supabaseKey === process.env.SUPABASE_ANON_KEY) keyType = 'ANON_KEY';

console.log(`Using Supabase ${keyType}: ${supabaseKey ? `${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 4)}` : 'Not set'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

// Create Supabase client with explicit options for better reliability
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    headers: {
      'X-Client-Info': 'launchpad-backend'
    }
  }
});

// Test the connection immediately
console.log('Testing Supabase connection...');
supabase.auth.getSession()
  .then(() => console.log('✅ Supabase connection test successful'))
  .catch(err => console.error('❌ Supabase connection test failed:', err.message));

// Test the Supabase Storage connection
console.log('Testing Supabase Storage connection...');

// First try to directly access the sites bucket
console.log('Directly checking if sites bucket exists and is accessible...');

supabase.storage.from('sites').list()
  .then(({ data, error }) => {
    if (!error) {
      console.log('✅ SITES BUCKET CONFIRMED: Successfully accessed the sites bucket directly');
      console.log(`Found ${data ? data.length : 0} files in the sites bucket`);
    } else {
      console.error('❌ SITES BUCKET ACCESS ERROR:', error.message);
      console.log('Will try listing all buckets to see if sites bucket is visible...');
      
      // If direct access fails, try listing all buckets
      supabase.storage.listBuckets()
        .then(({ data: buckets, error: listError }) => {
          if (listError) {
            console.error('Supabase Storage bucket listing failed:', listError.message);
            console.error('This is likely a permissions issue with your Supabase key');
            console.error('Make sure you are using the SERVICE_KEY with proper permissions');
          } else {
            if (!buckets || buckets.length === 0) {
              console.log('No buckets found in Supabase Storage.');
              console.warn('This is likely a permissions issue - the buckets exist but your key cannot see them');
              console.warn('Check that you are using the SERVICE_KEY with proper permissions');
            } else {
              console.log('Available buckets:', buckets.map(b => b.name).join(', '));
              
              // Check if the sites bucket exists in the list
              const sitesBucketExists = buckets.some(bucket => bucket.name === 'sites');
              if (sitesBucketExists) {
                console.log('✅ Sites bucket found in bucket list');
              } else {
                console.warn('⚠️ Sites bucket not found in bucket list, but it might still exist');
                console.warn('This is likely a permissions issue with your Supabase key');
              }
            }
          }
        })
        .catch(listErr => {
          console.error('Error listing buckets:', listErr.message);
        });
    }
  })
  .catch(err => {
    console.error('Error checking sites bucket:', err.message);
  });

/**
 * Ensure that the specified bucket exists
 * @param {string} bucketName - The name of the bucket to check/create
 * @returns {Promise<boolean>} - True if bucket exists or was created
 */
async function ensureBucketExists(bucketName) {
  try {
    console.log(`Checking if bucket '${bucketName}' exists...`);
    
    // First try to list files in the bucket - this is most reliable
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1 });
    
    if (!listError) {
      console.log(`Bucket '${bucketName}' exists and is accessible.`);
      return true;
    }
    
    console.log(`Could not list files in bucket '${bucketName}', error:`, listError);
    
    // Check if the error is a 404 (bucket doesn't exist) or something else
    if (listError.statusCode === 404) {
      console.log(`Bucket '${bucketName}' does not exist. Creating...`);
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true
      });
      
      if (createError) {
        console.error(`Error creating bucket '${bucketName}':`, createError);
        
        // If creation fails with 409, it means the bucket already exists
        if (createError.statusCode === 409) {
          console.log(`Bucket '${bucketName}' already exists (409 conflict).`);
          return true;
        }
        
        return false;
      }
      
      console.log(`Bucket '${bucketName}' created successfully.`);
      return true;
    }
    
    console.log(`Trying to list all buckets to check if '${bucketName}' exists...`);
    
    // If listing files fails with non-404, try to list all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      
      // If we can't list buckets, it might be a permission issue
      // Let's assume the bucket exists and try to proceed
      console.log('Could not list buckets, assuming bucket exists due to permission restrictions');
      return true;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log(`Bucket '${bucketName}' exists.`);
      return true;
    }
    
    console.log(`Bucket '${bucketName}' does not exist. Creating...`);
    const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    
    if (createError) {
      console.error(`Error creating bucket '${bucketName}':`, createError);
      return false;
    }
    
    console.log(`Bucket '${bucketName}' created successfully.`);
    return true;
  } catch (error) {
    console.error(`Error ensuring bucket '${bucketName}' exists:`, error);
    return false;
  }
}

/**
 * Upload a file to Supabase Storage
 * @param {string} bucketName - The name of the bucket to upload to
 */
async function uploadFileToStorage(bucketName, filePath, storagePath) {
  try {
    console.log(`Uploading file to ${bucketName}/${storagePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return { success: false, error: `File not found: ${filePath}` };
    }
    
    // Read file content
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath);
    } catch (readError) {
      console.error(`Error reading file ${filePath}:`, readError);
      return { success: false, error: `Error reading file: ${readError.message}` };
    }
    
    // Make sure the bucket exists before uploading
    const bucketExists = await ensureBucketExists(bucketName);
    if (!bucketExists) {
      console.warn(`Bucket ${bucketName} does not exist or could not be created`);
      // We'll try to upload anyway
    }
    
    // Upload file to Supabase Storage with retry logic
    let uploadAttempts = 0;
    const maxAttempts = 3;
    
    while (uploadAttempts < maxAttempts) {
      uploadAttempts++;
      
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, fileContent, {
            contentType: mime.lookup(filePath) || 'application/octet-stream',
            upsert: true
          });
        
        if (error) {
          console.error(`Error uploading file to ${bucketName}/${storagePath} (attempt ${uploadAttempts}/${maxAttempts}):`, error);
          
          if (uploadAttempts >= maxAttempts) {
            return { success: false, error: `Upload failed after ${maxAttempts} attempts: ${error.message}` };
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        console.log(`File uploaded successfully to ${bucketName}/${storagePath}`);
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);
        
        if (!urlData || !urlData.publicUrl) {
          console.warn(`Could not get public URL for ${bucketName}/${storagePath}`);
          return { 
            success: true, 
            url: `https://ryxdrgeavvumuhsarnzq.supabase.co/storage/v1/object/public/${bucketName}/${storagePath}` 
          };
        }
        
        return { success: true, url: urlData.publicUrl };
      } catch (uploadError) {
        console.error(`Exception uploading file (attempt ${uploadAttempts}/${maxAttempts}):`, uploadError);
        
        if (uploadAttempts >= maxAttempts) {
          return { success: false, error: `Upload failed after ${maxAttempts} attempts: ${uploadError.message}` };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { success: false, error: 'Upload failed after maximum attempts' };
  } catch (error) {
    console.error('Error in uploadFileToStorage:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the public URL for a file in Supabase Storage
 * @param {string} bucketName - The name of the bucket
 * @param {string} storagePath - The path within the bucket
 * @returns {string} - The public URL
 */
function getPublicUrl(bucketName, storagePath) {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file or folder from Supabase Storage
 * @param {string} bucketName - The name of the bucket
 * @param {string} storagePath - The path to the file or folder in storage
 * @returns {Promise<any>} - The result of the delete operation
 */
async function deleteFromStorage(bucketName, storagePath) {
  try {
    console.log(`Deleting from storage: ${bucketName}/${storagePath}`);
    
    // Check if the bucket exists first
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('Error checking buckets:', bucketError);
      return { success: false, error: 'Could not check buckets' };
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    if (!bucketExists) {
      console.warn(`Bucket ${bucketName} does not exist, nothing to delete`);
      return { success: true, message: 'Nothing to delete, bucket does not exist' };
    }
    
    // Check if it's a folder by listing its contents
    const { data: folderContents, error: listError } = await supabase.storage
      .from(bucketName)
      .list(storagePath);
    
    if (listError) {
      // If we can't list the contents, it might not be a folder or might not exist
      console.warn(`Could not list contents at ${bucketName}/${storagePath}:`, listError);
      
      // Try direct deletion anyway (might be a file or might not exist)
      const { data, error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);
      
      if (error) {
        // Check if it's a "not found" type error, which we can ignore
        if (error.message && (error.message.includes('not found') || error.message.includes('does not exist'))) {
          console.log(`Path ${storagePath} does not exist in bucket ${bucketName}, nothing to delete`);
          return { success: true, message: 'Nothing to delete, path does not exist' };
        }
        
        console.error(`Error deleting ${storagePath}:`, error);
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    }
    
    if (folderContents && folderContents.length > 0) {
      // It's a folder with contents, delete each item
      console.log(`Deleting folder contents: ${folderContents.length} items`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Delete each item one by one to better handle errors
      for (const item of folderContents) {
        try {
          const itemPath = `${storagePath}/${item.name}`;
          console.log(`Deleting item: ${itemPath}`);
          
          const { error } = await supabase.storage
            .from(bucketName)
            .remove([itemPath]);
          
          if (error) {
            console.error(`Error deleting ${itemPath}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (itemError) {
          console.error(`Exception deleting item:`, itemError);
          errorCount++;
        }
      }
      
      console.log(`Deleted ${successCount} items with ${errorCount} errors`);
      
      // Now try to delete the empty folder
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .remove([storagePath]);
        
        if (error) {
          console.warn(`Could not delete folder ${storagePath} after deleting contents:`, error);
        } else {
          console.log(`Successfully deleted folder ${storagePath}`);
        }
        
        return { 
          success: true, 
          deleted: successCount, 
          errors: errorCount,
          folderDeleted: !error
        };
      } catch (folderError) {
        console.warn(`Exception deleting folder ${storagePath}:`, folderError);
        return { 
          success: true, 
          deleted: successCount, 
          errors: errorCount,
          folderDeleted: false
        };
      }
    } else {
      // Empty folder or file, try direct deletion
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .remove([storagePath]);
        
        if (error) {
          console.error(`Error deleting ${storagePath}:`, error);
          return { success: false, error: error.message };
        }
        
        console.log(`Successfully deleted ${storagePath}`);
        return { success: true, data };
      } catch (deleteError) {
        console.error(`Exception deleting ${storagePath}:`, deleteError);
        return { success: false, error: deleteError.message };
      }
    }
  } catch (error) {
    console.error('Error in deleteFromStorage:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get content type based on file extension
 * @param {string} filePath - The file path
 * @returns {string} - The content type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = {
  uploadFileToStorage,
  getPublicUrl,
  deleteFromStorage,
  ensureBucketExists,
  supabase
};
