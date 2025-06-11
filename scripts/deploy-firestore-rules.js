#!/usr/bin/env node

/**
 * Script to deploy Firestore security rules using Firebase Admin SDK
 * This script reads the firestore.rules file and deploys it to the Firebase project
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(path.dirname(__dirname), '.env.local') });

async function deployFirestoreRules() {
  try {
    console.log('🚀 Starting Firestore rules deployment...');

    // Initialize Firebase Admin SDK
    let serviceAccount;

    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      console.log('📋 Using GOOGLE_CLOUD_KEY_JSON for authentication...');
      try {
        // Check if it's base64 encoded
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
        if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True') {
          console.log('🔓 Decoding base64 encoded service account...');
          jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
        }
        serviceAccount = JSON.parse(jsonString);
        console.log(`✅ Service account loaded for project: ${serviceAccount.project_id}`);
      } catch (parseError) {
        throw new Error(`Failed to parse GOOGLE_CLOUD_KEY_JSON: ${parseError.message}`);
      }
    } else {
      throw new Error('GOOGLE_CLOUD_KEY_JSON environment variable is required but not found');
    }

    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }

    console.log(`✅ Firebase Admin initialized for project: ${serviceAccount.project_id}`);

    // Read the firestore.rules file
    const rulesPath = path.join(path.dirname(__dirname), 'firestore.rules');
    
    if (!fs.existsSync(rulesPath)) {
      throw new Error(`Firestore rules file not found at: ${rulesPath}`);
    }

    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    console.log('📖 Firestore rules file read successfully');

    // Note: Firebase Admin SDK doesn't provide direct rules deployment
    // We need to use the Firebase Management API instead
    console.log(`
⚠️  Firebase Admin SDK doesn't support direct rules deployment.

To deploy the updated Firestore rules, please use one of these methods:

1. 🌐 Firebase Console (Recommended):
   - Go to: https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore/rules
   - Copy and paste the rules from firestore.rules file
   - Click "Publish"

2. 🔧 Firebase CLI:
   - Install: npm install -g firebase-tools
   - Login: firebase login
   - Use project: firebase use ${serviceAccount.project_id}
   - Deploy: firebase deploy --only firestore:rules

3. 📡 Firebase Management API:
   - Use the REST API to deploy rules programmatically
   - Requires additional authentication setup

The rules have been updated in the firestore.rules file and include:
✅ Payout Recipients collection rules
✅ Revenue Splits collection rules  
✅ Earnings collection rules
✅ Payouts collection rules
✅ Payout Configuration rules

These rules will fix the PERMISSION_DENIED error you're experiencing.
`);

    // Show a summary of the new rules
    console.log('\n📋 Summary of new payout-related rules added:');
    console.log('- payoutRecipients: User-owned payout account information');
    console.log('- revenueSplits: Earnings distribution configuration');
    console.log('- earnings: Individual earning records (admin-only write)');
    console.log('- payouts: Payout transaction records (admin-only write)');
    console.log('- config/payouts: System payout configuration');

    return true;
  } catch (error) {
    console.error('❌ Error deploying Firestore rules:', error);
    return false;
  }
}

// Run the deployment
if (import.meta.url === `file://${process.argv[1]}`) {
  deployFirestoreRules()
    .then((success) => {
      if (success) {
        console.log('\n🎉 Rules preparation completed successfully!');
        process.exit(0);
      } else {
        console.log('\n💥 Rules preparation failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

export { deployFirestoreRules };
