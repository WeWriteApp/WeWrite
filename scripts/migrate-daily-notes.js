#!/usr/bin/env node

/**
 * Migration script to convert existing daily notes from YYYY-MM-DD titles to "Daily note" titles
 * with customDate field populated.
 * 
 * This script:
 * 1. Finds all pages with YYYY-MM-DD format titles
 * 2. Changes their titles to "Daily note"
 * 3. Sets the customDate field to the original date
 * 4. Preserves all other page data
 * 
 * Usage: node scripts/migrate-daily-notes.js [--dry-run] [--batch-size=50]
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (!admin.apps.length) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://wewrite-app-default-rtdb.firebaseio.com/'
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    console.error('Make sure firebase-service-account.json exists in the project root');
    process.exit(1);
  }
}

const db = admin.firestore();

/**
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 */
function isExactDateFormat(title) {
  if (!title || title.length !== 10) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
}

/**
 * Validate that a date string is a valid date
 */
function isValidDate(dateString) {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return !isNaN(date.getTime()) && 
           date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  } catch (error) {
    return false;
  }
}

/**
 * Get all pages that match the daily note pattern
 */
async function getDailyNotePages(batchSize = 50) {
  console.log('🔍 Scanning for daily note pages...');
  
  const dailyNotes = [];
  let lastDoc = null;
  let totalScanned = 0;
  
  while (true) {
    let query = db.collection('pages')
      .orderBy('title')
      .limit(batchSize);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      break;
    }
    
    totalScanned += snapshot.docs.length;
    console.log(`📄 Scanned ${totalScanned} pages so far...`);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Check if this is a daily note (exact YYYY-MM-DD format)
      if (data.title && isExactDateFormat(data.title) && isValidDate(data.title)) {
        // Skip if already migrated (has customDate field)
        if (!data.customDate) {
          dailyNotes.push({
            id: doc.id,
            title: data.title,
            userId: data.userId,
            username: data.username || 'Unknown',
            createdAt: data.createdAt,
            lastModified: data.lastModified
          });
        }
      }
    });
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
  
  console.log(`✅ Found ${dailyNotes.length} daily notes to migrate out of ${totalScanned} total pages`);
  return dailyNotes;
}

/**
 * Migrate a batch of daily notes
 */
async function migrateBatch(dailyNotes, startIndex, batchSize, dryRun = false) {
  const batch = db.batch();
  const endIndex = Math.min(startIndex + batchSize, dailyNotes.length);
  
  console.log(`\n📝 Processing batch ${Math.floor(startIndex / batchSize) + 1}: pages ${startIndex + 1}-${endIndex}`);
  
  for (let i = startIndex; i < endIndex; i++) {
    const note = dailyNotes[i];
    const pageRef = db.collection('pages').doc(note.id);
    
    const updateData = {
      title: 'Daily note',
      customDate: note.title, // Original YYYY-MM-DD title becomes customDate
      lastModified: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (dryRun) {
      console.log(`  📋 [DRY RUN] Would update page ${note.id}:`);
      console.log(`      Old title: "${note.title}" → New title: "Daily note"`);
      console.log(`      Custom date: ${note.title}`);
      console.log(`      User: ${note.username} (${note.userId})`);
    } else {
      batch.update(pageRef, updateData);
      console.log(`  ✏️  Updating page ${note.id}: "${note.title}" → "Daily note" (customDate: ${note.title})`);
    }
  }
  
  if (!dryRun && batch._writes.length > 0) {
    await batch.commit();
    console.log(`  ✅ Batch committed successfully`);
  }
  
  return endIndex - startIndex;
}

/**
 * Main migration function
 */
async function migrateDailyNotes() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;
  
  console.log('🚀 Daily Notes Migration Script');
  console.log('================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('');
  
  try {
    // Get all daily note pages
    const dailyNotes = await getDailyNotePages();
    
    if (dailyNotes.length === 0) {
      console.log('🎉 No daily notes found to migrate. All done!');
      return;
    }
    
    // Show summary
    console.log('\n📊 Migration Summary:');
    console.log(`Total pages to migrate: ${dailyNotes.length}`);
    console.log(`Estimated batches: ${Math.ceil(dailyNotes.length / batchSize)}`);
    
    // Group by user for better visibility
    const userCounts = {};
    dailyNotes.forEach(note => {
      userCounts[note.username] = (userCounts[note.username] || 0) + 1;
    });
    
    console.log('\n👥 Pages by user:');
    Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([username, count]) => {
        console.log(`  ${username}: ${count} daily notes`);
      });
    
    if (dryRun) {
      console.log('\n⚠️  This is a DRY RUN. No changes will be made.');
      console.log('   Remove --dry-run flag to perform actual migration.');
    } else {
      console.log('\n⚠️  This will modify your database. Make sure you have a backup!');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Process in batches
    let totalMigrated = 0;
    for (let i = 0; i < dailyNotes.length; i += batchSize) {
      const migrated = await migrateBatch(dailyNotes, i, batchSize, dryRun);
      totalMigrated += migrated;
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < dailyNotes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`${dryRun ? 'Would have migrated' : 'Successfully migrated'} ${totalMigrated} daily notes`);
    
    if (!dryRun) {
      console.log('\n📋 Next steps:');
      console.log('1. Update your application code to use the new customDate field');
      console.log('2. Test the daily notes functionality');
      console.log('3. Consider creating a Firestore index on customDate for better performance');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateDailyNotes()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDailyNotes, isExactDateFormat, isValidDate };
