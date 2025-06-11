#!/usr/bin/env node

/**
 * Simple script to deploy Firestore rules using Google Auth Library
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(path.dirname(__dirname), '.env.local') });

async function deployFirestoreRules() {
  try {
    console.log('🚀 Starting Firestore rules deployment...');

    // Get service account credentials
    let credentials;
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
      if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True') {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
      }
      credentials = JSON.parse(jsonString);
      console.log('✅ Loaded service account credentials');
    } else {
      throw new Error('GOOGLE_CLOUD_KEY_JSON not found');
    }

    // Initialize Google Auth
    const auth = new GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.rules'],
    });

    const authClient = await auth.getClient();
    console.log('✅ Authenticated with Google');

    // Read the rules file
    const rulesPath = path.join(path.dirname(__dirname), 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    console.log('📖 Read Firestore rules file');

    const projectId = 'wewrite-ccd82';

    // Create a new ruleset
    console.log('📤 Creating new ruleset...');
    const createRulesetResponse = await authClient.request({
      url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      method: 'POST',
      data: {
        source: {
          files: [
            {
              name: 'firestore.rules',
              content: rulesContent,
            },
          ],
        },
      },
    });

    const rulesetName = createRulesetResponse.data.name;
    console.log('✅ Created ruleset:', rulesetName);

    // Release the ruleset to Firestore
    console.log('🚀 Releasing ruleset to Firestore...');
    const releaseResponse = await authClient.request({
      url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
      method: 'PATCH',
      data: {
        rulesetName: rulesetName,
      },
    });

    console.log('🎉 Successfully deployed Firestore rules!');
    console.log('📋 Release name:', releaseResponse.data.name);
    console.log('📋 Ruleset name:', releaseResponse.data.rulesetName);
    
    console.log('\n✅ The payout permission error should now be fixed!');
    console.log('🔄 Try setting up payouts again in the application.');

    return true;
  } catch (error) {
    console.error('❌ Error deploying Firestore rules:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the deployment
deployFirestoreRules()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
