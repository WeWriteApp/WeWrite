/**
 * Re-linkify User Bios Migration Script
 * 
 * This script scans all user bios and re-creates links for text that matches
 * existing page titles. This fixes bios that had links corrupted to plain text.
 * 
 * HOW IT WORKS:
 * 1. Fetches all users with bio content
 * 2. Fetches all page titles from the database
 * 3. For each bio, scans text nodes for matches to page titles
 * 4. Converts matching text to proper LinkNode structure
 * 5. Optionally updates the database (--dry-run to preview)
 * 
 * USAGE:
 *   node scripts/relinkify-user-bios.js --dry-run    # Preview changes
 *   node scripts/relinkify-user-bios.js              # Apply changes
 *   node scripts/relinkify-user-bios.js --user=USER_ID  # Fix single user
 * 
 * SAFETY:
 * - Always run with --dry-run first
 * - Creates backup of original bio before modifying
 * - Only converts exact title matches (case-insensitive)
 * - Won't re-linkify text that's already inside a link
 */

require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const userArg = args.find(arg => arg.startsWith('--user='));
const SINGLE_USER_ID = userArg ? userArg.split('=')[1] : null;

// Determine environment
const IS_DEV = process.env.NODE_ENV !== 'production' && !args.includes('--production');
const COLLECTION_PREFIX = IS_DEV ? 'DEV_' : '';

console.log('='.repeat(60));
console.log('🔗 Re-linkify User Bios Migration Script');
console.log('='.repeat(60));
console.log(`Environment: ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (changes will be applied)'}`);
if (SINGLE_USER_ID) console.log(`Target User: ${SINGLE_USER_ID}`);
console.log('='.repeat(60));

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountJson = Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'wewrite-ccd82'
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

/**
 * Build an index of all page titles -> page data
 * Uses lowercase title as key for case-insensitive matching
 */
async function buildPageTitleIndex() {
  console.log('\n📚 Building page title index...');
  
  const pagesCollection = `${COLLECTION_PREFIX}pages`;
  const snapshot = await db.collection(pagesCollection)
    .where('deleted', '!=', true)
    .get();
  
  const titleIndex = new Map();
  let publicCount = 0;
  let privateCount = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.title || data.deleted === true) return;
    
    const titleLower = data.title.toLowerCase().trim();
    
    // Skip very short titles (likely to cause false matches)
    if (titleLower.length < 3) return;
    
    // Only include pages that would be linkable
    const isPublic = data.isPublic !== false;
    if (isPublic) publicCount++;
    else privateCount++;
    
    // Store page info for this title (prefer public pages, then by most recent)
    const existing = titleIndex.get(titleLower);
    if (!existing || (isPublic && !existing.isPublic) || 
        (isPublic === existing.isPublic && data.lastModified > existing.lastModified)) {
      titleIndex.set(titleLower, {
        pageId: doc.id,
        title: data.title,
        userId: data.userId,
        username: data.username,
        isPublic: isPublic,
        lastModified: data.lastModified
      });
    }
  });
  
  console.log(`   Found ${titleIndex.size} unique page titles`);
  console.log(`   (${publicCount} public, ${privateCount} private pages)`);
  
  return titleIndex;
}

/**
 * Create a LinkNode for a matched page
 */
function createLinkNode(pageInfo, displayText) {
  return {
    type: 'link',
    pageId: pageInfo.pageId,
    pageTitle: pageInfo.title,
    url: `/pages/${pageInfo.pageId}`,
    isCustomText: displayText.toLowerCase() !== pageInfo.title.toLowerCase(),
    ...(displayText.toLowerCase() !== pageInfo.title.toLowerCase() && { customText: displayText }),
    children: [{ text: displayText }],
    isPublic: pageInfo.isPublic,
    isOwned: false  // We don't know if the bio owner owns this page
  };
}

/**
 * Find all text segments that match page titles within a text string
 * Returns matches sorted by position (start index)
 */
function findTitleMatches(text, titleIndex) {
  const matches = [];
  const textLower = text.toLowerCase();
  
  // Check each title against the text
  for (const [titleLower, pageInfo] of titleIndex.entries()) {
    // Find all occurrences of this title in the text
    let searchStart = 0;
    while (searchStart < textLower.length) {
      const index = textLower.indexOf(titleLower, searchStart);
      if (index === -1) break;
      
      // Check word boundaries to avoid partial matches
      // e.g., "Resume" shouldn't match inside "Presumed"
      const charBefore = index > 0 ? text[index - 1] : ' ';
      const charAfter = index + titleLower.length < text.length ? text[index + titleLower.length] : ' ';
      
      const isWordBoundaryBefore = /[\s\.,!?;:\-\(\)\[\]"'`]/.test(charBefore);
      const isWordBoundaryAfter = /[\s\.,!?;:\-\(\)\[\]"'`]/.test(charAfter);
      
      if (isWordBoundaryBefore && isWordBoundaryAfter) {
        matches.push({
          start: index,
          end: index + titleLower.length,
          originalText: text.substring(index, index + titleLower.length),
          pageInfo: pageInfo
        });
      }
      
      searchStart = index + 1;
    }
  }
  
  // Sort by position and remove overlapping matches (prefer longer matches)
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end; // Prefer longer match at same position
  });
  
  // Remove overlapping matches
  const nonOverlapping = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }
  
  return nonOverlapping;
}

/**
 * Process a single text node and return array of nodes (text + links)
 */
function processTextNode(textNode, titleIndex) {
  if (!textNode.text || typeof textNode.text !== 'string') {
    return [textNode];
  }
  
  const text = textNode.text;
  const matches = findTitleMatches(text, titleIndex);
  
  if (matches.length === 0) {
    return [textNode];
  }
  
  // Split text into segments with links
  const result = [];
  let lastIndex = 0;
  
  for (const match of matches) {
    // Add text before this match
    if (match.start > lastIndex) {
      result.push({ text: text.substring(lastIndex, match.start) });
    }
    
    // Add the link node
    result.push(createLinkNode(match.pageInfo, match.originalText));
    
    lastIndex = match.end;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    result.push({ text: text.substring(lastIndex) });
  }
  
  return result;
}

/**
 * Recursively process content nodes, converting text matches to links
 */
function processContent(content, titleIndex) {
  if (!Array.isArray(content)) {
    return content;
  }
  
  let hasChanges = false;
  const result = [];
  
  for (const node of content) {
    // Skip if this is already a link node
    if (node.type === 'link') {
      result.push(node);
      continue;
    }
    
    // Process text nodes at the root level
    if (node.text !== undefined && node.type === undefined) {
      const processed = processTextNode(node, titleIndex);
      if (processed.length > 1 || processed[0] !== node) {
        hasChanges = true;
        result.push(...processed);
      } else {
        result.push(node);
      }
      continue;
    }
    
    // Process paragraph or other container nodes
    if (node.type === 'paragraph' || node.children) {
      const processedChildren = processContent(node.children || [], titleIndex);
      
      if (processedChildren !== node.children) {
        hasChanges = true;
        result.push({
          ...node,
          children: processedChildren
        });
      } else {
        result.push(node);
      }
      continue;
    }
    
    // Pass through other nodes unchanged
    result.push(node);
  }
  
  return hasChanges ? result : content;
}

/**
 * Process a single user's bio
 */
async function processUserBio(userDoc, titleIndex, stats) {
  const userData = userDoc.data();
  const userId = userDoc.id;
  const username = userData.username || userData.displayName || 'Unknown';
  
  if (!userData.bio) {
    return null;
  }
  
  let bioContent = userData.bio;
  
  // Handle string bios (legacy format)
  if (typeof bioContent === 'string') {
    // Convert string to paragraph structure for processing
    bioContent = [{ type: 'paragraph', children: [{ text: bioContent }] }];
  }
  
  if (!Array.isArray(bioContent)) {
    if (VERBOSE) console.log(`   ⚠️  Skipping ${username}: Bio is not an array`);
    return null;
  }
  
  // Count existing links in bio
  const existingLinkCount = JSON.stringify(bioContent).split('"type":"link"').length - 1;
  
  // Process the content
  const processedContent = processContent(bioContent, titleIndex);
  
  // Check if anything changed
  const originalJson = JSON.stringify(bioContent);
  const processedJson = JSON.stringify(processedContent);
  
  if (originalJson === processedJson) {
    if (VERBOSE) console.log(`   ⏭️  ${username}: No changes needed`);
    stats.unchanged++;
    return null;
  }
  
  // Count new links added
  const newLinkCount = processedJson.split('"type":"link"').length - 1;
  const linksAdded = newLinkCount - existingLinkCount;
  
  console.log(`\n   📝 ${username} (${userId}):`);
  console.log(`      Existing links: ${existingLinkCount}`);
  console.log(`      Links added: ${linksAdded}`);
  
  if (VERBOSE) {
    // Show what was matched
    const matchInfo = [];
    const extractMatches = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'link' && node.pageTitle) {
          matchInfo.push(`"${node.children?.[0]?.text || node.pageTitle}" → ${node.pageTitle}`);
        }
        if (node.children) extractMatches(node.children);
      }
    };
    extractMatches(processedContent);
    if (matchInfo.length > 0) {
      console.log(`      Matches: ${matchInfo.slice(0, 5).join(', ')}${matchInfo.length > 5 ? `, +${matchInfo.length - 5} more` : ''}`);
    }
  }
  
  stats.modified++;
  stats.linksAdded += linksAdded;
  
  return {
    userId,
    username,
    originalBio: bioContent,
    processedBio: processedContent,
    linksAdded
  };
}

/**
 * Main migration function
 */
async function relinkifyBios() {
  const startTime = Date.now();
  
  try {
    // Build page title index
    const titleIndex = await buildPageTitleIndex();
    
    if (titleIndex.size === 0) {
      console.log('\n❌ No pages found in database. Aborting.');
      return;
    }
    
    // Fetch users with bios
    console.log('\n👥 Fetching users with bios...');
    const usersCollection = `${COLLECTION_PREFIX}users`;
    
    let query = db.collection(usersCollection);
    if (SINGLE_USER_ID) {
      // Process single user
      const userDoc = await db.collection(usersCollection).doc(SINGLE_USER_ID).get();
      if (!userDoc.exists) {
        console.log(`\n❌ User ${SINGLE_USER_ID} not found.`);
        return;
      }
      var userDocs = [userDoc];
      console.log(`   Processing single user: ${SINGLE_USER_ID}`);
    } else {
      // Process all users with bios
      const snapshot = await query.get();
      var userDocs = snapshot.docs.filter(doc => doc.data().bio);
      console.log(`   Found ${userDocs.length} users with bios`);
    }
    
    // Process each user
    console.log('\n🔄 Processing bios...');
    
    const stats = {
      total: userDocs.length,
      modified: 0,
      unchanged: 0,
      linksAdded: 0,
      errors: 0
    };
    
    const changes = [];
    
    for (const userDoc of userDocs) {
      try {
        const change = await processUserBio(userDoc, titleIndex, stats);
        if (change) {
          changes.push(change);
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${userDoc.id}:`, error.message);
        stats.errors++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users scanned: ${stats.total}`);
    console.log(`Users with changes: ${stats.modified}`);
    console.log(`Users unchanged: ${stats.unchanged}`);
    console.log(`Total links added: ${stats.linksAdded}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Time elapsed: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    if (changes.length === 0) {
      console.log('\n✅ No changes needed. All bios are up to date.');
      return;
    }
    
    // Apply changes (if not dry run)
    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN - No changes applied.');
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log('\n💾 Applying changes...');
      
      const batch = db.batch();
      let batchCount = 0;
      
      for (const change of changes) {
        const userRef = db.collection(usersCollection).doc(change.userId);
        
        // Store backup of original bio
        const backupData = {
          bio: change.processedBio,
          bioBackup: change.originalBio,
          bioRelinkifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          bioRelinkifyLinksAdded: change.linksAdded
        };
        
        batch.update(userRef, backupData);
        batchCount++;
        
        // Firestore batch limit is 500
        if (batchCount >= 450) {
          await batch.commit();
          console.log(`   Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   Committed final batch of ${batchCount} updates`);
      }
      
      console.log('\n✅ Changes applied successfully!');
      console.log('   Original bios backed up to "bioBackup" field.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
relinkifyBios().then(() => {
  console.log('\n🎉 Script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
