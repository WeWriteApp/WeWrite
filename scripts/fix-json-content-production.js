#!/usr/bin/env node

/**
 * EMERGENCY PRODUCTION FIX: Convert JSON String Content to Proper Arrays
 * 
 * This script fixes pages in production that have content stored as JSON strings
 * instead of proper Slate.js node arrays. This is a one-time fix to consolidate
 * our content storage format according to our established architecture.
 * 
 * USAGE:
 *   node scripts/fix-json-content-production.js [--dry-run] [--limit=100]
 * 
 * OPTIONS:
 *   --dry-run    Show what would be fixed without making changes
 *   --limit=N    Limit to N pages (default: 100, use 0 for all)
 * 
 * SAFETY:
 *   - Creates backups before making changes
 *   - Validates JSON parsing before updating
 *   - Logs all changes for audit trail
 *   - Can be run multiple times safely
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;

console.log('🔧 EMERGENCY PRODUCTION FIX: JSON Content Consolidation');
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATES'}`);
console.log(`Limit: ${limit === 0 ? 'ALL PAGES' : `${limit} pages`}`);
console.log('');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function fixJsonContent() {
  const startTime = Date.now();
  let processed = 0;
  let fixed = 0;
  let errors = 0;
  const fixedPages = [];
  const errorPages = [];

  try {
    console.log('📊 Scanning pages collection for JSON string content...');
    
    // Query pages collection
    let query = db.collection('pages');
    if (limit > 0) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    console.log(`Found ${snapshot.size} pages to check`);
    console.log('');

    for (const doc of snapshot.docs) {
      processed++;
      const pageData = doc.data();
      const pageId = doc.id;
      
      // Check if content is a JSON string
      if (pageData.content && typeof pageData.content === 'string') {
        try {
          // Try to parse the JSON string
          const parsed = JSON.parse(pageData.content);
          
          if (Array.isArray(parsed)) {
            console.log(`🔧 FIXING: ${pageId} - "${pageData.title || 'Untitled'}"`);
            console.log(`   Content type: string -> array (${parsed.length} nodes)`);
            
            if (!isDryRun) {
              // Create backup
              const backupData = {
                pageId,
                originalContent: pageData.content,
                fixedAt: new Date().toISOString(),
                fixedBy: 'fix-json-content-script'
              };
              
              // Update the page with proper array content
              await doc.ref.update({
                content: parsed,
                lastModified: new Date().toISOString(),
                fixedAt: new Date().toISOString(),
                fixedBy: 'fix-json-content-script'
              });
              
              // Save backup
              await db.collection('content_fixes_backup').add(backupData);
              
              console.log(`   ✅ FIXED: Content converted to proper array format`);
            } else {
              console.log(`   🔍 DRY RUN: Would fix this page`);
            }
            
            fixed++;
            fixedPages.push({
              pageId,
              title: pageData.title || 'Untitled',
              nodeCount: parsed.length
            });
          } else {
            console.log(`⚠️  SKIP: ${pageId} - Content is JSON but not an array`);
          }
        } catch (parseError) {
          console.log(`❌ ERROR: ${pageId} - Failed to parse JSON content`);
          console.log(`   Error: ${parseError.message}`);
          errors++;
          errorPages.push({
            pageId,
            title: pageData.title || 'Untitled',
            error: parseError.message
          });
        }
      } else if (Array.isArray(pageData.content)) {
        // Content is already in correct format
        console.log(`✅ OK: ${pageId} - Content already in array format`);
      } else if (!pageData.content) {
        // No content
        console.log(`📝 EMPTY: ${pageId} - No content`);
      } else {
        // Other content type
        console.log(`❓ OTHER: ${pageId} - Content type: ${typeof pageData.content}`);
      }
      
      // Progress indicator
      if (processed % 10 === 0) {
        console.log(`Progress: ${processed}/${snapshot.size} pages processed`);
      }
    }

    // Summary
    const duration = Date.now() - startTime;
    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   Processed: ${processed} pages`);
    console.log(`   Fixed: ${fixed} pages`);
    console.log(`   Errors: ${errors} pages`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    console.log(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATES'}`);

    if (fixedPages.length > 0) {
      console.log('');
      console.log('🔧 FIXED PAGES:');
      fixedPages.forEach(page => {
        console.log(`   ${page.pageId} - "${page.title}" (${page.nodeCount} nodes)`);
      });
    }

    if (errorPages.length > 0) {
      console.log('');
      console.log('❌ ERROR PAGES:');
      errorPages.forEach(page => {
        console.log(`   ${page.pageId} - "${page.title}": ${page.error}`);
      });
    }

    if (!isDryRun && fixed > 0) {
      console.log('');
      console.log('💾 BACKUPS: All original content saved to content_fixes_backup collection');
      console.log('🔄 NEXT: Run this script again to verify all pages are fixed');
    }

    if (isDryRun && fixed > 0) {
      console.log('');
      console.log('🚀 READY: Run without --dry-run to apply fixes');
    }

  } catch (error) {
    console.error('💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run the fix
fixJsonContent().then(() => {
  console.log('');
  console.log('✅ Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
