import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin';

// Type definitions for Firebase Admin operations
interface CustomServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface EnvironmentCheck {
  hasProjectId: boolean;
  hasPrivateKey: boolean;
  hasClientEmail: boolean;
  hasDbUrl: boolean;
}

// Singleton pattern to ensure we only initialize the app once
let firebaseAdmin: typeof admin | null = null;

export function getFirebaseAdmin(): typeof admin | null {
  if (firebaseAdmin) {
    console.log('[Firebase Admin] Returning existing Firebase Admin instance');
    return firebaseAdmin;
  }

  console.log('[Firebase Admin] Initializing Firebase Admin...');
  console.log('[Firebase Admin] Environment check:', {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON,
    hasLoggingCloudKey: !!process.env.LOGGING_CLOUD_KEY_JSON,
    hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasNextPublicFirebasePid: !!process.env.NEXT_PUBLIC_FIREBASE_PID
  });

  // Skip initialization during build time
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV) {
    console.log('[Firebase Admin] Skipping Firebase Admin initialization during build time');
    return null;
  }

  try {
    // Check if any Firebase apps have been initialized
    if (admin.apps.length === 0) {
      // For development environment, use a service account or default credentials
      if (process.env.NODE_ENV === 'development') {
        try {
          // Try to use the same service account JSON parsing logic as production
          if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
            let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
            let keySource = process.env.GOOGLE_CLOUD_KEY_JSON ? 'GOOGLE_CLOUD_KEY_JSON' : 'LOGGING_CLOUD_KEY_JSON';

            console.log(`[Development] Attempting to use ${keySource} for Firebase Admin`);

            // Handle different service account formats
            if (keySource === 'LOGGING_CLOUD_KEY_JSON') {
              // Remove actual newline characters that break JSON parsing
              jsonString = jsonString.replace(/\n/g, '');
              // Also remove carriage returns if present
              jsonString = jsonString.replace(/\r/g, '');
            }

            // Check if the string is base64 encoded
            if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
              try {
                jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
                console.log(`[Development] Decoded base64-encoded ${keySource}`);
              } catch (decodeError) {
                console.warn(`[Development] Failed to decode ${keySource} as base64, using original string:`, decodeError.message);
              }
            }

            const serviceAccount = JSON.parse(jsonString);

            // Validate that the service account has the required fields
            if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
              throw new Error(`Invalid service account in ${keySource}: missing required fields`);
            }

            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount as ServiceAccount),
              databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || "https://wewrite-ccd82-default-rtdb.firebaseio.com"
            });

            console.log(`[Development] Firebase Admin initialized successfully with ${keySource}: ${serviceAccount.client_email}`);
          } else {
            // Fallback to individual environment variables
            const serviceAccount: CustomServiceAccount = {
              type: 'service_account',
              project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82',
              private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'dev-key-id',
              private_key: process.env.FIREBASE_PRIVATE_KEY ?
                process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') :
                'dummy-key',
              client_email: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@example.com',
              client_id: process.env.FIREBASE_CLIENT_ID || 'dummy-client-id',
              auth_uri: 'https://accounts.google.com/o/oauth2/auth',
              token_uri: 'https://oauth2.googleapis.com/token',
              auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
              client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/dummy'
            };

            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount as ServiceAccount),
              databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DB_URL || "https://wewrite-ccd82-default-rtdb.firebaseio.com"
            });

            console.log('[Development] Firebase Admin initialized with individual environment variables');
          }
        } catch (e: any) {
          console.error('[Development] Error initializing Firebase Admin with service account:', e.message);
          console.warn('[Development] Using fallback Firebase Admin initialization without credentials');
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82'
          });
        }
      } else {
        // Production initialization with proper credentials
        try {
          // Check if we have service account JSON (try GOOGLE first, then LOGGING)
          if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
            try {
              // Try GOOGLE_CLOUD_KEY_JSON first (has working permissions), then LOGGING_CLOUD_KEY_JSON as fallback
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
              if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
                try {
                  // Try to decode as base64
                  jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
                  console.log(`Decoded base64-encoded ${keySource} in firebaseAdmin`);
                } catch (decodeError) {
                  console.warn(`Failed to decode ${keySource} as base64, using original string:`, decodeError.message);
                }
              }

              const serviceAccount = JSON.parse(jsonString);

              // Validate that the service account has the required fields
              if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
                throw new Error(`Invalid service account in ${keySource}: missing required fields`);
              }

              admin.initializeApp({
                credential: admin.credential.cert(serviceAccount as ServiceAccount),
                databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
              });

              console.log(`Firebase Admin initialized successfully with ${keySource}: ${serviceAccount.client_email}`);
              firebaseAdmin = admin;
              return firebaseAdmin;
            } catch (parseError) {
              console.error('Error parsing service account JSON in firebaseAdmin:', parseError.message);

              // If LOGGING_CLOUD_KEY_JSON failed, try GOOGLE_CLOUD_KEY_JSON as fallback
              if (process.env.LOGGING_CLOUD_KEY_JSON && process.env.GOOGLE_CLOUD_KEY_JSON) {
                console.log('Falling back to GOOGLE_CLOUD_KEY_JSON in firebaseAdmin...');
                try {
                  let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;

                  if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
                    jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
                    console.log('Decoded base64-encoded GOOGLE_CLOUD_KEY_JSON in firebaseAdmin');
                  }

                  const serviceAccount = JSON.parse(jsonString);

                  admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount as ServiceAccount),
                    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
                  });

                  console.log(`Firebase Admin initialized with fallback: ${serviceAccount.client_email}`);
                  firebaseAdmin = admin;
                  return firebaseAdmin;
                } catch (fallbackError) {
                  console.error('Fallback also failed in firebaseAdmin:', fallbackError.message);
                  // Fall through to individual environment variables
                }
              }
              // Fall through to individual environment variables
            }
          }

          // Log environment variables (without sensitive data)
          const envCheck: EnvironmentCheck = {
            hasProjectId: !!process.env.FIREBASE_PROJECT_ID || !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
            hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            hasDbUrl: !!process.env.FIREBASE_DATABASE_URL || !!process.env.NEXT_PUBLIC_FIREBASE_DB_URL
          };
          console.log('Firebase Admin initialization - Environment check:', envCheck);

          // Create service account with fallbacks for different environment variable names
          const serviceAccount: CustomServiceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'key-id',
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'dummy-key',
            client_email: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@example.com',
            client_id: process.env.FIREBASE_CLIENT_ID || 'client-id',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/dummy'
          };

          // Ensure required fields are present
          if (!serviceAccount.project_id) {
            throw new Error('Missing required project_id in service account');
          }
          if (!serviceAccount.private_key) {
            throw new Error('Missing required private_key in service account');
          }
          if (!serviceAccount.client_email) {
            throw new Error('Missing required client_email in service account');
          }

          // Get database URL with fallback
          const databaseURL = process.env.FIREBASE_DATABASE_URL ||
                             process.env.NEXT_PUBLIC_FIREBASE_DB_URL ||
                             `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as ServiceAccount),
            databaseURL: databaseURL
          });

          console.log(`Firebase Admin initialized successfully with project: ${serviceAccount.project_id}`);
        } catch (error: any) {
          console.error('Error initializing Firebase Admin with service account:', error);

          // Fallback initialization for Vercel preview environments
          console.warn('Attempting fallback initialization for Vercel preview...');
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'wewrite-ccd82'
          });
        }
      }
    }

    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (error: any) {
    console.error("Error initializing Firebase Admin:", error);
    throw new Error("Failed to initialize Firebase Admin");
  }
}