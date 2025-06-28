import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let isInitialized = false;

export const initAdmin = () => {
  if (isInitialized) {
    return admin;
  }

  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      isInitialized = true;
      return admin;
    }

    // Initialize with service account
    let serviceAccount;
    
    // Use GOOGLE_CLOUD_KEY_JSON (bigquery service account) which has working permissions
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      // Parse from environment variable (Vercel/production)
      try {
        // Use GOOGLE_CLOUD_KEY_JSON first (has working permissions), then LOGGING_CLOUD_KEY_JSON as fallback
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
        let keySource = process.env.GOOGLE_CLOUD_KEY_JSON ? 'GOOGLE_CLOUD_KEY_JSON' : 'LOGGING_CLOUD_KEY_JSON';

        // Handle different service account formats
        if (keySource === 'LOGGING_CLOUD_KEY_JSON') {
          // Remove actual newline characters that break JSON parsing
          jsonString = jsonString.replace(/\n/g, '');
          // Also remove carriage returns if present
          jsonString = jsonString.replace(/\r/g, '');
        }

        // Check if the string is base64 encoded (common in Vercel deployments)
        // Base64 strings typically don't contain spaces and have specific patterns
        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          try {
            // Try to decode as base64
            jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
            console.log(`Decoded base64-encoded ${keySource}`);
          } catch (decodeError) {
            console.warn(`Failed to decode ${keySource} as base64, using original string:`, decodeError.message);
          }
        }

        serviceAccount = JSON.parse(jsonString);
        console.log(`Using service account from ${keySource}: ${serviceAccount.client_email}`);

        // Validate that the service account has the required fields
        if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
          throw new Error(`Invalid service account in ${keySource}: missing required fields`);
        }

      } catch (parseError) {
        console.error('Error parsing service account JSON:', parseError.message);

        // If LOGGING_CLOUD_KEY_JSON failed, try GOOGLE_CLOUD_KEY_JSON as fallback
        if (process.env.LOGGING_CLOUD_KEY_JSON && process.env.GOOGLE_CLOUD_KEY_JSON) {
          console.log('Falling back to GOOGLE_CLOUD_KEY_JSON...');
          try {
            let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;

            if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
              jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
              console.log('Decoded base64-encoded GOOGLE_CLOUD_KEY_JSON');
            }

            serviceAccount = JSON.parse(jsonString);
            console.log(`Using fallback service account: ${serviceAccount.client_email}`);
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError.message);
            throw new Error(`Failed to parse both service account JSONs: ${parseError.message}`);
          }
        } else {
          throw new Error(`Failed to parse service account JSON: ${parseError.message}`);
        }
      }
    } else {
      // Create from individual environment variables
      serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });

    isInitialized = true;
    console.log('Firebase Admin initialized successfully');
    return admin;
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
};

// Export admin instance
export { admin };

// Export getFirebaseAdmin function for compatibility
export const getFirebaseAdmin = () => {
  return initAdmin();
};

// Auto-initialize if in server environment, but not during build time
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'production') {
  try {
    initAdmin();
  } catch (error) {
    console.warn('Firebase Admin auto-initialization failed, will retry on first use:', error.message);
  }
}
