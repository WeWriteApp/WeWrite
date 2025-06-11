#!/usr/bin/env node

/**
 * Deploy Firestore rules using Firebase Management API
 * This bypasses the need for Firebase CLI authentication
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(path.dirname(__dirname), '.env.local') });

async function getAccessToken() {
  try {
    // Get service account from environment
    let serviceAccount;
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
      if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True') {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
      }
      serviceAccount = JSON.parse(jsonString);
    } else {
      throw new Error('GOOGLE_CLOUD_KEY_JSON not found');
    }

    // Create JWT for service account authentication
    const jwt = await createJWT(serviceAccount);
    
    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

async function createJWT(serviceAccount) {
  // For simplicity, let's use a different approach
  // We'll use the Google Auth Library instead
  const { GoogleAuth } = await import('google-auth-library');
  
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/firebase'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  return accessToken.token;
}

async function deployRules() {
  try {
    console.log('🚀 Deploying Firestore rules using Management API...');

    // Get access token
    const accessToken = await getAccessToken();
    console.log('✅ Got access token');

    // Read rules file
    const rulesPath = path.join(path.dirname(__dirname), 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    console.log('📖 Read rules file');

    // Get project ID
    const projectId = 'wewrite-ccd82';

    // Deploy rules using Firebase Management API
    const response = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: {
            files: [
              {
                name: 'firestore.rules',
                content: rulesContent,
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create ruleset: ${response.status} ${errorText}`);
    }

    const ruleset = await response.json();
    console.log('✅ Created ruleset:', ruleset.name);

    // Release the ruleset
    const releaseResponse = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rulesetName: ruleset.name,
        }),
      }
    );

    if (!releaseResponse.ok) {
      const errorText = await releaseResponse.text();
      throw new Error(`Failed to release ruleset: ${releaseResponse.status} ${errorText}`);
    }

    const release = await releaseResponse.json();
    console.log('🎉 Successfully deployed Firestore rules!');
    console.log('📋 Release:', release.name);

    return true;
  } catch (error) {
    console.error('❌ Error deploying rules:', error);
    return false;
  }
}

// Install google-auth-library if not present
async function ensureDependencies() {
  try {
    await import('google-auth-library');
  } catch (error) {
    console.log('📦 Installing google-auth-library...');
    const { execSync } = await import('child_process');
    execSync('npm install google-auth-library', { stdio: 'inherit' });
  }
}

// Run the deployment
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDependencies()
    .then(() => deployRules())
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

export { deployRules };
