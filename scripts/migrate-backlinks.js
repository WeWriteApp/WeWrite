// @ts-check
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch,
  query,
  where
} from 'firebase/firestore';

// Initialize Firebase with environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
console.log('Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey,
  hasAppId: !!firebaseConfig.appId,
  env: process.env.NODE_ENV || 'unknown'
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to extract page ID from URL
function extractPageIdFromUrl(url) {
  if (!url) return null;
  
  // Handle direct pageId
  if (url.match(/^[A-Za-z0-9-_]+$/)) {
    return url;
  }
  
  // Handle /pages/pageId format
  const match = url.match(/\/pages\/([A-Za-z0-9-_]+)/);
  return match ? match[1] : null;
}

// Find all links in a page's content
function findLinksInContent(content) {
  const links = new Set();
  
  if (Array.isArray(content)) {
    content.forEach(node => {
      // Check top-level links
      if (node.type === 'link' || node.type === 'internal-link') {
        const url = node.url || node.href || node.link || '';
        const targetId = extractPageIdFromUrl(url);
        if (targetId) links.add(targetId);
      }
      
      // Check child nodes
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
          if (child.type === 'link' || child.type === 'internal-link') {
            const url = child.url || child.href || child.link || '';
            const targetId = extractPageIdFromUrl(url);
            if (targetId) links.add(targetId);
          }
        });
      }
    });
  }
  
  return Array.from(links);
}

async function migrateBacklinks() {
  try {
    console.log('Starting backlinks migration...');
    
    // Get all pages
    const pagesRef = collection(db, 'pages');
    console.log('Fetching pages...');
    const pagesSnap = await getDocs(pagesRef);
    
    if (pagesSnap.empty) {
      console.log('No pages found to migrate');
      return;
    }
    
    console.log(`Found ${pagesSnap.size} pages to process`);
    
    // Process pages in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    let totalBacklinks = 0;
    let processedPages = 0;
    let currentBatch = writeBatch(db);
    let batchCount = 0;
    
    const backlinksRef = collection(db, 'backlinks');
    
    for (const pageDoc of pagesSnap.docs) {
      const page = pageDoc.data();
      const sourcePageId = pageDoc.id;
      
      if (!page.content) {
        console.log(`Skipping page ${sourcePageId} - no content`);
        continue;
      }
      
      // Find all links in the page content
      const targetPageIds = findLinksInContent(page.content);
      console.log(`Found ${targetPageIds.length} links in page ${sourcePageId}`);
      
      // Create backlink entries
      for (const targetPageId of targetPageIds) {
        if (targetPageId === sourcePageId) {
          console.log(`Skipping self-reference in page ${sourcePageId}`);
          continue;
        }
        
        const backlinkRef = doc(backlinksRef);
        currentBatch.set(backlinkRef, {
          sourcePageId,
          targetPageId,
          createdAt: new Date().toISOString()
        });
        
        batchCount++;
        totalBacklinks++;
        
        // If we've reached the batch limit, commit and start a new batch
        if (batchCount >= BATCH_SIZE) {
          console.log(`Committing batch of ${batchCount} backlinks...`);
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          batchCount = 0;
          console.log('Batch committed successfully');
        }
      }
      
      processedPages++;
      if (processedPages % 100 === 0) {
        console.log(`Processed ${processedPages} pages...`);
      }
    }
    
    // Commit any remaining backlinks
    if (batchCount > 0) {
      console.log(`Committing final batch of ${batchCount} backlinks...`);
      await currentBatch.commit();
      console.log('Final batch committed successfully');
    }
    
    console.log(`
Migration complete:
- Processed ${processedPages} pages
- Created ${totalBacklinks} backlinks
    `);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
console.log('Starting migration script...');
migrateBacklinks().then(() => {
  console.log('Migration completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
