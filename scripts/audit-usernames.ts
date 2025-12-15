/**
 * Username Audit Script
 *
 * This script audits all usernames in the production database and identifies
 * invalid usernames that need to be fixed. It can also fix invalid usernames
 * automatically.
 *
 * Usage:
 *   npx tsx scripts/audit-usernames.ts [--fix] [--env production|development]
 *
 * Options:
 *   --fix          Actually fix the invalid usernames (default: dry run)
 *   --env          Environment to run against (default: production)
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Parse command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const envArg = args.find(arg => arg.startsWith('--env='));
const environment = envArg ? envArg.split('=')[1] : 'production';

console.log(`
=================================================
          USERNAME AUDIT SCRIPT
=================================================
Mode: ${shouldFix ? 'FIX' : 'DRY RUN'}
Environment: ${environment}
=================================================
`);

// Username validation (matches app/utils/usernameValidation.ts)
const USERNAME_REGEX = /^[a-zA-Z0-9_.\-]{3,30}$/;

function validateUsername(username: string | null | undefined): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!username || typeof username !== 'string') {
    return { valid: false, errors: ['Username is null, undefined, or not a string'] };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    errors.push('Too short (< 3 characters)');
  }

  if (trimmed.length > 30) {
    errors.push('Too long (> 30 characters)');
  }

  if (/\s/.test(trimmed)) {
    errors.push('Contains whitespace');
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    errors.push('Contains invalid characters (only letters, numbers, underscores, dashes, and periods allowed)');
  }

  // Cannot start or end with a period, dash, or underscore
  if (/^[._\-]|[._\-]$/.test(trimmed)) {
    errors.push('Starts or ends with period, dash, or underscore');
  }

  // Cannot have consecutive special characters
  if (/[._\-]{2,}/.test(trimmed)) {
    errors.push('Has consecutive special characters');
  }

  // Check for invalid placeholder values
  const invalidValues = ['anonymous', 'missing username', 'user', 'undefined', 'null'];
  if (invalidValues.includes(trimmed.toLowerCase())) {
    errors.push('Is a placeholder/invalid value');
  }

  // Check for generated usernames (user_xxxxx pattern) - these are technically valid but may need review
  if (/^user_[a-zA-Z0-9]+$/i.test(trimmed)) {
    // Don't mark as error, but note it
  }

  return { valid: errors.length === 0, errors };
}

function generateFixedUsername(originalUsername: string, userId: string): string {
  if (!originalUsername) {
    return `user_${userId.slice(0, 8)}`;
  }

  // Replace whitespace with underscores
  let cleaned = originalUsername.replace(/\s+/g, '_');

  // Remove any characters that aren't alphanumeric, underscores, dashes, or periods
  cleaned = cleaned.replace(/[^a-zA-Z0-9_.\-]/g, '');

  // Remove multiple consecutive special characters
  cleaned = cleaned.replace(/[._\-]{2,}/g, '_');

  // Remove leading/trailing special characters
  cleaned = cleaned.replace(/^[._\-]+|[._\-]+$/g, '');

  // Ensure minimum length
  if (cleaned.length < 3) {
    if (cleaned.length > 0) {
      cleaned = cleaned + '_' + userId.slice(0, 8 - cleaned.length - 1);
    } else {
      cleaned = `user_${userId.slice(0, 8)}`;
    }
  }

  // Ensure maximum length
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30);
    cleaned = cleaned.replace(/[._\-]+$/, '');
  }

  return cleaned;
}

async function main() {
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    let serviceAccount: admin.ServiceAccount;

    // Try GOOGLE_CLOUD_KEY_JSON first (same as app/firebase/admin.ts)
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      try {
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON || '';
        const keySource = process.env.GOOGLE_CLOUD_KEY_JSON ? 'GOOGLE_CLOUD_KEY_JSON' : 'LOGGING_CLOUD_KEY_JSON';

        // Handle newlines in LOGGING_CLOUD_KEY_JSON
        if (keySource === 'LOGGING_CLOUD_KEY_JSON') {
          jsonString = jsonString.replace(/\n/g, '').replace(/\r/g, '');
        }

        // Check if base64 encoded
        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          try {
            jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
            console.log(`Decoded base64-encoded ${keySource}`);
          } catch (decodeError) {
            console.warn(`Failed to decode ${keySource} as base64, using original string`);
          }
        }

        serviceAccount = JSON.parse(jsonString);
        console.log(`Using service account from ${keySource}: ${serviceAccount.client_email}`);
      } catch (parseError) {
        console.error('Error parsing service account JSON:', parseError);
        process.exit(1);
      }
    } else {
      // Fall back to individual environment variables
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        console.error('Missing Firebase credentials. Please check your .env.local file.');
        console.error('Need either GOOGLE_CLOUD_KEY_JSON or FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL');
        process.exit(1);
      }

      serviceAccount = {
        projectId,
        privateKey,
        clientEmail,
      } as admin.ServiceAccount;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${(serviceAccount as any).project_id || 'wewrite-ccd82'}.firebaseio.com`,
    });
  }

  const db = admin.firestore();
  const collectionName = environment === 'production' ? 'users' : 'DEV_users';

  console.log(`Fetching users from collection: ${collectionName}`);

  // Get all users
  const usersSnapshot = await db.collection(collectionName).get();
  console.log(`Found ${usersSnapshot.size} users to audit\n`);

  const results = {
    total: usersSnapshot.size,
    valid: 0,
    invalid: 0,
    fixed: 0,
    failed: 0,
    noUsername: 0,
    generatedUsernames: 0,
  };

  const invalidUsers: { id: string; username: string | null; errors: string[]; suggestedFix: string }[] = [];
  const generatedUsers: { id: string; username: string }[] = [];

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const username = userData.username;

    // Track users with generated usernames
    if (username && /^user_[a-zA-Z0-9]+$/i.test(username)) {
      results.generatedUsernames++;
      generatedUsers.push({ id: userId, username });
    }

    // Track users without any username
    if (!username) {
      results.noUsername++;
      invalidUsers.push({
        id: userId,
        username: null,
        errors: ['No username set'],
        suggestedFix: generateFixedUsername('', userId),
      });
      results.invalid++;
      continue;
    }

    const validation = validateUsername(username);

    if (validation.valid) {
      results.valid++;
    } else {
      results.invalid++;
      invalidUsers.push({
        id: userId,
        username,
        errors: validation.errors,
        suggestedFix: generateFixedUsername(username, userId),
      });
    }
  }

  // Print results
  console.log('=================================================');
  console.log('                    RESULTS');
  console.log('=================================================');
  console.log(`Total users:           ${results.total}`);
  console.log(`Valid usernames:       ${results.valid}`);
  console.log(`Invalid usernames:     ${results.invalid}`);
  console.log(`No username set:       ${results.noUsername}`);
  console.log(`Generated usernames:   ${results.generatedUsernames}`);
  console.log('=================================================\n');

  if (invalidUsers.length > 0) {
    console.log('INVALID USERNAMES:');
    console.log('-------------------------------------------------');
    for (const user of invalidUsers) {
      console.log(`User ID: ${user.id}`);
      console.log(`  Current: "${user.username || '(null)'}"`);
      console.log(`  Errors: ${user.errors.join(', ')}`);
      console.log(`  Suggested fix: "${user.suggestedFix}"`);
      console.log('');
    }
  }

  if (generatedUsers.length > 0 && generatedUsers.length <= 20) {
    console.log('\nUSERS WITH GENERATED USERNAMES (may need review):');
    console.log('-------------------------------------------------');
    for (const user of generatedUsers) {
      console.log(`  ${user.id}: ${user.username}`);
    }
    console.log('');
  }

  // Fix invalid usernames if --fix flag is provided
  if (shouldFix && invalidUsers.length > 0) {
    console.log('\n=================================================');
    console.log('                  FIXING USERNAMES');
    console.log('=================================================\n');

    for (const user of invalidUsers) {
      try {
        // Check if the suggested username is already taken
        let finalUsername = user.suggestedFix;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          const existingUser = await db.collection(collectionName)
            .where('username', '==', finalUsername)
            .limit(1)
            .get();

          if (existingUser.empty) {
            break;
          }

          // If taken, add a random suffix
          const randomSuffix = Math.floor(Math.random() * 10000);
          const base = user.suggestedFix.length > 24
            ? user.suggestedFix.slice(0, 24)
            : user.suggestedFix;
          finalUsername = `${base}_${randomSuffix}`;
          attempts++;
        }

        if (attempts >= maxAttempts) {
          console.log(`  FAILED: ${user.id} - Could not find available username after ${maxAttempts} attempts`);
          results.failed++;
          continue;
        }

        // Update the user document
        await db.collection(collectionName).doc(user.id).update({
          username: finalUsername,
          usernameUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          usernameUpdatedReason: 'audit-script-fix',
          previousUsername: user.username || null,
        });

        console.log(`  FIXED: ${user.id}`);
        console.log(`    From: "${user.username || '(null)'}" -> "${finalUsername}"`);
        results.fixed++;

      } catch (error) {
        console.error(`  ERROR: ${user.id} - ${error}`);
        results.failed++;
      }
    }

    console.log('\n=================================================');
    console.log('                FIX SUMMARY');
    console.log('=================================================');
    console.log(`Fixed:   ${results.fixed}`);
    console.log(`Failed:  ${results.failed}`);
    console.log('=================================================');
  } else if (!shouldFix && invalidUsers.length > 0) {
    console.log('\n[DRY RUN] To fix these usernames, run with --fix flag:');
    console.log('  npx tsx scripts/audit-usernames.ts --fix');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
