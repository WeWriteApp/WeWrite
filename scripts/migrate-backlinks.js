#!/usr/bin/env tsx

/**
 * Backlinks Migration Script
 *
 * This script migrates the existing WeWrite database to use the new efficient
 * backlinks index system. It processes all existing pages and creates backlinks
 * index entries for pages that contain links to other pages.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  try {
    let serviceAccount;

    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
      if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      }
      serviceAccount = JSON.parse(jsonString);
    } else if (process.env.LOGGING_CLOUD_KEY_JSON) {
      let jsonString = process.env.LOGGING_CLOUD_KEY_JSON;
      jsonString = jsonString.replace(/\n/g, '').replace(/\r/g, '');
      serviceAccount = JSON.parse(jsonString);
    } else {
      throw new Error('No service account found');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL
    });

    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

// Firebase Admin is already initialized above

// Configuration
const CONFIG = {
  dryRun: process.argv.includes('--dry-run'),
  batchSize: parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 100,
  verbose: process.argv.includes('--verbose'),
  limit: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null
};

// Statistics
const STATS = {
  pagesProcessed: 0,
  pagesWithContent: 0,
  pagesWithLinks: 0,
  backlinksCreated: 0,
  errors: 0
};

/**
 * Extract links from Slate.js content nodes
 */
function extractLinksFromNodes(nodes) {
  const links = [];
  
  const extractFromNode = (node) => {
    // Check if this node is a page link
    if (node.pageId && node.isPageLink) {
      links.push({
        type: 'page',
        pageId: node.pageId,
        url: node.url || '',
        text: node.displayText || node.pageTitle || ''
      });
      return;
    }
    
    // Check if this node is a link with URL
    if (node.type === 'link' || node.url || node.href) {
      const url = node.url || node.href || '';
      let linkText = node.text || node.displayText || '';
      
      if (!linkText && node.children && Array.isArray(node.children)) {
        linkText = node.children.map(child => child.text || '').join('');
      }
      
      // Check if it's a page link based on URL
      if (url.startsWith('/pages/')) {
        const pageId = url.replace('/pages/', '').split(/[\/\?#]/)[0];
        if (pageId) {
          links.push({
            type: 'page',
            pageId: pageId,
            url: url,
            text: linkText
          });
        }
      } else if (url.startsWith('/') && url.length > 1 && !url.includes('/user/')) {
        const pageId = url.substring(1).split(/[\/\?#]/)[0];
        if (pageId && !pageId.includes('/')) {
          links.push({
            type: 'page',
            pageId: pageId,
            url: url,
            text: linkText
          });
        }
      }
    }
    
    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(extractFromNode);
    }
  };
  
  if (Array.isArray(nodes)) {
    nodes.forEach(extractFromNode);
  }
  
  return links;
}

/**
 * Log function with timestamp
 */
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Verbose log function
 */
function verbose(message) {
  if (CONFIG.verbose) {
    console.log(`[VERBOSE] ${message}`);
  }
}

/**
 * Process a batch of pages
 */
async function processBatch(pages) {
  const batch = writeBatch(db);
  let batchCount = 0;
  
  for (const pageDoc of pages) {
    const pageData = pageDoc.data();
    const pageId = pageDoc.id;
    
    STATS.pagesProcessed++;
    
    // Skip deleted pages
    if (pageData.deleted === true) {
      verbose(`Skipping deleted page: ${pageId}`);
      continue;
    }
    
    // Skip pages without content
    if (!pageData.content) {
      verbose(`Skipping page without content: ${pageId}`);
      continue;
    }
    
    STATS.pagesWithContent++;
    
    // Parse content
    let contentNodes;
    try {
      if (typeof pageData.content === 'string') {
        contentNodes = JSON.parse(pageData.content);
      } else {
        contentNodes = pageData.content;
      }
    } catch (parseError) {
      verbose(`Failed to parse content for page ${pageId}: ${parseError.message}`);
      STATS.errors++;
      continue;
    }
    
    // Extract links
    const links = extractLinksFromNodes(contentNodes);
    const pageLinks = links.filter(link => link.type === 'page' && link.pageId);
    
    if (pageLinks.length === 0) {
      verbose(`No page links found in ${pageId}`);
      continue;
    }
    
    STATS.pagesWithLinks++;
    verbose(`Found ${pageLinks.length} page links in ${pageId}`);
    
    // Create backlink entries
    for (const link of pageLinks) {
      const backlinkId = `${pageId}_to_${link.pageId}`;
      const backlinkRef = doc(db, 'backlinks', backlinkId);
      
      const backlinkEntry = {
        id: backlinkId,
        sourcePageId: pageId,
        sourcePageTitle: pageData.title || 'Untitled',
        sourceUsername: pageData.username || 'Anonymous',
        targetPageId: link.pageId,
        linkText: link.text || '',
        linkUrl: link.url || '',
        createdAt: new Date(),
        lastModified: pageData.lastModified || pageData.createdAt || new Date().toISOString(),
        isPublic: pageData.isPublic !== false // Default to true if not specified
      };
      
      if (!CONFIG.dryRun) {
        batch.set(backlinkRef, backlinkEntry);
        batchCount++;
      }
      
      STATS.backlinksCreated++;
      
      // Commit batch if it gets too large
      if (batchCount >= 500) {
        if (!CONFIG.dryRun) {
          await batch.commit();
        }
        log(`Committed batch of ${batchCount} backlinks`);
        batchCount = 0;
      }
    }
  }
  
  // Commit remaining entries
  if (batchCount > 0 && !CONFIG.dryRun) {
    await batch.commit();
    log(`Committed final batch of ${batchCount} backlinks`);
  }
}

/**
 * Main migration function
 */
async function migrateBacklinks() {
  log('🚀 Starting backlinks migration...');
  log(`Configuration: ${JSON.stringify(CONFIG, null, 2)}`);
  
  if (CONFIG.dryRun) {
    log('🔍 DRY RUN MODE - No data will be written');
  }
  
  try {
    // Clear existing backlinks collection if not dry run
    if (!CONFIG.dryRun) {
      log('🗑️ Clearing existing backlinks collection...');
      const existingBacklinks = await getDocs(collection(db, 'backlinks'));
      
      if (!existingBacklinks.empty) {
        const deleteBatch = writeBatch(db);
        existingBacklinks.docs.forEach(doc => {
          deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        log(`Deleted ${existingBacklinks.size} existing backlinks`);
      }
    }
    
    // Query pages
    let pagesQuery = query(
      collection(db, 'pages'),
      orderBy('lastModified', 'desc')
    );
    
    if (CONFIG.limit) {
      pagesQuery = query(pagesQuery, limit(CONFIG.limit));
    }
    
    const pagesSnapshot = await getDocs(pagesQuery);
    log(`Found ${pagesSnapshot.size} pages to process`);
    
    // Process pages in batches
    const pages = pagesSnapshot.docs;
    for (let i = 0; i < pages.length; i += CONFIG.batchSize) {
      const batch = pages.slice(i, i + CONFIG.batchSize);
      log(`Processing batch ${Math.floor(i / CONFIG.batchSize) + 1}/${Math.ceil(pages.length / CONFIG.batchSize)} (${batch.length} pages)`);
      
      await processBatch(batch);
    }
    
    // Print final statistics
    log('\n📊 Migration completed!');
    log(`Statistics:`);
    log(`  - Pages processed: ${STATS.pagesProcessed}`);
    log(`  - Pages with content: ${STATS.pagesWithContent}`);
    log(`  - Pages with links: ${STATS.pagesWithLinks}`);
    log(`  - Backlinks created: ${STATS.backlinksCreated}`);
    log(`  - Errors: ${STATS.errors}`);
    
    if (CONFIG.dryRun) {
      log('\n🔍 This was a dry run - no data was actually written');
      log('   Run without --dry-run to perform the actual migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Backlinks Migration Script

Usage:
  node scripts/migrate-backlinks.js [options]

Options:
  --dry-run          Run in dry-run mode (no data writes)
  --batch-size=N     Set batch size for processing (default: 100)
  --limit=N          Limit number of pages to process (for testing)
  --verbose          Enable verbose logging
  --help, -h         Show this help message

Examples:
  node scripts/migrate-backlinks.js --dry-run --verbose
  node scripts/migrate-backlinks.js --batch-size=50 --limit=1000
  node scripts/migrate-backlinks.js
`);
  process.exit(0);
}

// Run the migration
migrateBacklinks();
