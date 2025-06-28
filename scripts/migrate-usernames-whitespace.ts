#!/usr/bin/env tsx

/**
 * Username Whitespace Migration Script
 * 
 * This script migrates usernames containing whitespace characters by:
 * 1. Scanning all existing usernames in usernames collections
 * 2. Identifying usernames with whitespace characters
 * 3. Generating new usernames by replacing whitespace with underscores
 * 4. Handling conflicts if underscore versions already exist
 * 5. Updating both usernames and users collections
 * 6. Maintaining referential integrity
 * 7. Providing detailed logging and rollback capability
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
const { getFirebaseAdmin } = require('../app/firebase/firebaseAdmin');
const {
  getEnvironmentType,
  getCollectionName,
  logEnvironmentConfig
} = require('../app/utils/environmentConfig');

// Types
interface UsernameRecord {
  id: string; // document ID (the username)
  uid: string;
  createdAt: string;
  hasWhitespace: boolean;
}

interface UserRecord {
  id: string; // user ID
  username: string;
  email: string;
  [key: string]: any;
}

interface MigrationResult {
  oldUsername: string;
  newUsername: string;
  userId: string;
  success: boolean;
  error?: string;
}

interface MigrationSummary {
  totalUsernamesScanned: number;
  usernamesWithWhitespace: number;
  successfulMigrations: number;
  failedMigrations: number;
  conflicts: number;
  results: MigrationResult[];
  rollbackData: Array<{
    userId: string;
    oldUsername: string;
    newUsername: string;
    collections: string[];
  }>;
}

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 50;

// Initialize Firebase Admin
const admin = getFirebaseAdmin();
const db = admin ? admin.firestore() : null;

if (!db) {
  console.error('❌ Failed to initialize Firebase Admin');
  process.exit(1);
}

/**
 * Cleans username by replacing whitespace with underscores
 */
function cleanUsername(username: string): string {
  return username
    .replace(/\s+/g, '_')           // Replace whitespace with underscores
    .replace(/_+/g, '_')            // Remove consecutive underscores
    .replace(/^_+|_+$/g, '');       // Remove leading/trailing underscores
}

/**
 * Generates a unique username by appending numbers if conflicts exist
 */
async function generateUniqueUsername(
  baseUsername: string, 
  usernamesCollection: string,
  existingUsernames: Set<string>
): Promise<string> {
  let candidate = baseUsername;
  let counter = 2;
  
  while (existingUsernames.has(candidate.toLowerCase())) {
    candidate = `${baseUsername}_${counter}`;
    counter++;
    
    // Safety check to prevent infinite loops
    if (counter > 1000) {
      throw new Error(`Could not generate unique username for ${baseUsername}`);
    }
  }
  
  return candidate;
}

/**
 * Scans usernames collection for whitespace characters
 */
async function scanUsernamesCollection(collectionName: string): Promise<UsernameRecord[]> {
  console.log(`📊 Scanning collection: ${collectionName}`);
  
  const usernamesRef = db!.collection(collectionName);
  const snapshot = await usernamesRef.get();
  
  const records: UsernameRecord[] = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const username = doc.id;
    const hasWhitespace = /\s/.test(username);
    
    records.push({
      id: username,
      uid: data.uid,
      createdAt: data.createdAt,
      hasWhitespace
    });
  });
  
  console.log(`   Found ${records.length} total usernames`);
  console.log(`   Found ${records.filter(r => r.hasWhitespace).length} with whitespace`);
  
  return records;
}

/**
 * Gets user data from users collection
 */
async function getUserData(userId: string, usersCollection: string): Promise<UserRecord | null> {
  try {
    const userRef = db!.collection(usersCollection).doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    return {
      id: userId,
      ...userDoc.data()
    } as UserRecord;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    return null;
  }
}

/**
 * Migrates a single username
 */
async function migrateUsername(
  record: UsernameRecord,
  usersCollection: string,
  usernamesCollection: string,
  existingUsernames: Set<string>
): Promise<MigrationResult> {
  const { id: oldUsername, uid: userId } = record;
  
  try {
    // Get user data
    const userData = await getUserData(userId, usersCollection);
    if (!userData) {
      return {
        oldUsername,
        newUsername: '',
        userId,
        success: false,
        error: 'User not found'
      };
    }
    
    // Generate new username
    const baseClean = cleanUsername(oldUsername);
    const newUsername = await generateUniqueUsername(
      baseClean, 
      usernamesCollection, 
      existingUsernames
    );
    
    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would migrate: ${oldUsername} → ${newUsername}`);
      return {
        oldUsername,
        newUsername,
        userId,
        success: true
      };
    }
    
    // Perform migration in batch
    const batch = db!.batch();
    
    // 1. Create new username document
    const newUsernameRef = db!.collection(usernamesCollection).doc(newUsername.toLowerCase());
    batch.set(newUsernameRef, {
      uid: userId,
      createdAt: record.createdAt,
      migratedFrom: oldUsername,
      migratedAt: new Date().toISOString()
    });
    
    // 2. Update user document
    const userRef = db!.collection(usersCollection).doc(userId);
    batch.update(userRef, {
      username: newUsername,
      previousUsername: oldUsername,
      usernameMigratedAt: new Date().toISOString()
    });
    
    // 3. Delete old username document
    const oldUsernameRef = db!.collection(usernamesCollection).doc(oldUsername.toLowerCase());
    batch.delete(oldUsernameRef);
    
    // Execute batch
    await batch.commit();
    
    // Update our tracking set
    existingUsernames.add(newUsername.toLowerCase());
    existingUsernames.delete(oldUsername.toLowerCase());
    
    console.log(`   ✅ Migrated: ${oldUsername} → ${newUsername}`);
    
    return {
      oldUsername,
      newUsername,
      userId,
      success: true
    };
    
  } catch (error) {
    console.error(`   ❌ Failed to migrate ${oldUsername}:`, error);
    return {
      oldUsername,
      newUsername: '',
      userId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main migration function
 */
async function runMigration(): Promise<MigrationSummary> {
  console.log('🚀 Starting Username Whitespace Migration');
  console.log('==========================================');
  
  // Log environment info
  logEnvironmentConfig();
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }
  
  const summary: MigrationSummary = {
    totalUsernamesScanned: 0,
    usernamesWithWhitespace: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    conflicts: 0,
    results: [],
    rollbackData: []
  };
  
  // Get collection names for current environment
  const usersCollection = getCollectionName('users');
  const usernamesCollection = getCollectionName('usernames');
  
  console.log(`📁 Users collection: ${usersCollection}`);
  console.log(`📁 Usernames collection: ${usernamesCollection}`);
  
  try {
    // Scan usernames collection
    const usernameRecords = await scanUsernamesCollection(usernamesCollection);
    summary.totalUsernamesScanned = usernameRecords.length;
    
    // Filter records with whitespace
    const recordsWithWhitespace = usernameRecords.filter(r => r.hasWhitespace);
    summary.usernamesWithWhitespace = recordsWithWhitespace.length;
    
    if (recordsWithWhitespace.length === 0) {
      console.log('✅ No usernames with whitespace found. Migration not needed.');
      return summary;
    }
    
    console.log(`\n🔧 Found ${recordsWithWhitespace.length} usernames to migrate:`);
    recordsWithWhitespace.forEach(record => {
      console.log(`   - "${record.id}" (user: ${record.uid})`);
    });
    
    // Build set of existing usernames for conflict detection
    const existingUsernames = new Set(
      usernameRecords.map(r => r.id.toLowerCase())
    );
    
    // Process migrations in batches
    console.log(`\n🔄 Processing migrations...`);
    
    for (let i = 0; i < recordsWithWhitespace.length; i += BATCH_SIZE) {
      const batch = recordsWithWhitespace.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recordsWithWhitespace.length / BATCH_SIZE)}`);
      
      for (const record of batch) {
        const result = await migrateUsername(
          record,
          usersCollection,
          usernamesCollection,
          existingUsernames
        );
        
        summary.results.push(result);
        
        if (result.success) {
          summary.successfulMigrations++;
          
          // Store rollback data
          summary.rollbackData.push({
            userId: result.userId,
            oldUsername: result.oldUsername,
            newUsername: result.newUsername,
            collections: [usersCollection, usernamesCollection]
          });
        } else {
          summary.failedMigrations++;
        }
      }
      
      // Small delay between batches
      if (i + BATCH_SIZE < recordsWithWhitespace.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
  
  return summary;
}

/**
 * Generates rollback script
 */
function generateRollbackScript(summary: MigrationSummary): string {
  const rollbackCommands = summary.rollbackData.map(item => {
    return `// Rollback ${item.newUsername} → ${item.oldUsername}
// Update user document
await db.collection('${item.collections[0]}').doc('${item.userId}').update({
  username: '${item.oldUsername}',
  previousUsername: admin.firestore.FieldValue.delete(),
  usernameMigratedAt: admin.firestore.FieldValue.delete()
});

// Restore old username document
await db.collection('${item.collections[1]}').doc('${item.oldUsername.toLowerCase()}').set({
  uid: '${item.userId}',
  createdAt: '${new Date().toISOString()}'
});

// Delete new username document
await db.collection('${item.collections[1]}').doc('${item.newUsername.toLowerCase()}').delete();`;
  }).join('\n\n');
  
  return `/**
 * ROLLBACK SCRIPT - Generated ${new Date().toISOString()}
 * 
 * This script can be used to rollback the username migration.
 * Run this in a Node.js environment with Firebase Admin SDK.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

async function rollbackMigration() {
  console.log('Starting rollback...');
  
${rollbackCommands}
  
  console.log('Rollback completed');
}

// Uncomment to run rollback
// rollbackMigration().catch(console.error);`;
}

/**
 * Main execution
 */
async function main() {
  try {
    const summary = await runMigration();
    
    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`Total usernames scanned: ${summary.totalUsernamesScanned}`);
    console.log(`Usernames with whitespace: ${summary.usernamesWithWhitespace}`);
    console.log(`Successful migrations: ${summary.successfulMigrations}`);
    console.log(`Failed migrations: ${summary.failedMigrations}`);
    
    if (summary.failedMigrations > 0) {
      console.log('\n❌ Failed migrations:');
      summary.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   - ${r.oldUsername}: ${r.error}`);
        });
    }
    
    if (summary.successfulMigrations > 0 && !DRY_RUN) {
      // Generate rollback script
      const rollbackScript = generateRollbackScript(summary);
      const fs = require('fs');
      const rollbackPath = `rollback-username-migration-${Date.now()}.js`;
      fs.writeFileSync(rollbackPath, rollbackScript);
      console.log(`\n💾 Rollback script saved to: ${rollbackPath}`);
    }
    
    console.log('\n✅ Migration completed successfully');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runMigration, MigrationSummary };
