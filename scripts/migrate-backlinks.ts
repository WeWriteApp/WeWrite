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
    let serviceAccount: any;
    
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

interface BacklinkEntry {
  id: string;
  sourcePageId: string;
  sourcePageTitle: string;
  sourceUsername: string;
  targetPageId: string;
  linkText: string;
  linkUrl: string;
  createdAt: admin.firestore.Timestamp;
  lastModified: string;
  isPublic: boolean;
}

interface LinkData {
  type: 'page' | 'external';
  pageId?: string;
  url: string;
  text: string;
}

// Extract links from Slate.js content nodes
function extractLinksFromNodes(nodes: any[]): LinkData[] {
  const links: LinkData[] = [];

  const extractFromNode = (node: any) => {
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
        linkText = node.children.map((child: any) => child.text || '').join('');
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
    
    // Recursively check children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(extractFromNode);
    }
  };

  if (Array.isArray(nodes)) {
    nodes.forEach(extractFromNode);
  }

  return links.filter(link => link.type === 'page' && link.pageId);
}

async function migrateBacklinks() {
  console.log(`[${new Date().toISOString()}] 🚀 Starting backlinks migration...`);
  
  const CONFIG = {
    dryRun: process.argv.includes('--dry-run'),
    limit: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0') || null,
    verbose: process.argv.includes('--verbose')
  };
  
  console.log(`[${new Date().toISOString()}] Configuration:`, JSON.stringify(CONFIG, null, 2));

  try {
    // Clear existing backlinks
    console.log(`[${new Date().toISOString()}] 🗑️ Clearing existing backlinks collection...`);
    const backlinksSnapshot = await db.collection('backlinks').get();
    
    if (backlinksSnapshot.size > 0) {
      const batch = db.batch();
      backlinksSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (!CONFIG.dryRun) {
        await batch.commit();
      }
      console.log(`✅ Cleared ${backlinksSnapshot.size} existing backlinks`);
    }

    // Get pages - use simpler query to avoid index issues
    let pagesQuery = db.collection('pages');

    if (CONFIG.limit) {
      pagesQuery = pagesQuery.limit(CONFIG.limit);
    }

    const pagesSnapshot = await pagesQuery.get();
    console.log(`[${new Date().toISOString()}] Found ${pagesSnapshot.size} pages to process`);

    let processed = 0;
    let backlinkCount = 0;

    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;

      // Skip deleted pages
      if (pageData.deleted === true) {
        continue;
      }

      if (CONFIG.verbose) {
        console.log(`Processing page: ${pageId} - ${pageData.title}`);
      }

      // Parse content
      let contentNodes: any[] = [];
      if (pageData.content && typeof pageData.content === 'string') {
        try {
          contentNodes = JSON.parse(pageData.content);
        } catch (error) {
          console.warn(`Could not parse content for page ${pageId}`);
          continue;
        }
      }

      // Extract links
      const links = extractLinksFromNodes(contentNodes);
      const pageLinks = links.filter(link => link.type === 'page' && link.pageId);

      if (pageLinks.length > 0) {
        const batch = db.batch();
        
        for (const link of pageLinks) {
          const backlinkId = `${pageId}_to_${link.pageId}`;
          const backlinkRef = db.collection('backlinks').doc(backlinkId);
          
          const backlinkEntry: BacklinkEntry = {
            id: backlinkId,
            sourcePageId: pageId,
            sourcePageTitle: pageData.title || 'Untitled',
            sourceUsername: pageData.username || 'Anonymous',
            targetPageId: link.pageId!,
            linkText: link.text || '',
            linkUrl: link.url || '',
            createdAt: admin.firestore.Timestamp.now(),
            lastModified: pageData.lastModified || pageData.createdAt || new Date().toISOString(),
            isPublic: pageData.isPublic !== false
          };
          
          batch.set(backlinkRef, backlinkEntry);
          backlinkCount++;
        }
        
        if (!CONFIG.dryRun) {
          await batch.commit();
        }
        
        if (CONFIG.verbose) {
          console.log(`  Created ${pageLinks.length} backlinks`);
        }
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`[${new Date().toISOString()}] Processed ${processed}/${pagesSnapshot.size} pages...`);
      }
    }

    console.log(`[${new Date().toISOString()}] 📊 Migration completed!`);
    console.log(`[${new Date().toISOString()}] Statistics:`);
    console.log(`[${new Date().toISOString()}]   - Pages processed: ${processed}`);
    console.log(`[${new Date().toISOString()}]   - Backlinks created: ${backlinkCount}`);
    console.log(`[${new Date().toISOString()}]   - Dry run: ${CONFIG.dryRun}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateBacklinks();
