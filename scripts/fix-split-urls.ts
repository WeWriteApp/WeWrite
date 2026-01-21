/**
 * Fix Split URLs Migration Script
 *
 * Scans all pages for corrupted URL data where a URL prefix (like `https://www.`)
 * appears as a separate text node immediately before a link node, and fixes them
 * by merging the orphaned prefix into the link's display text.
 *
 * Usage:
 *   npx tsx scripts/fix-split-urls.ts --scan-only     # Report corrupted pages only
 *   npx tsx scripts/fix-split-urls.ts --dry-run       # Show what would be fixed
 *   npx tsx scripts/fix-split-urls.ts --fix           # Apply fixes (with backup)
 *   npx tsx scripts/fix-split-urls.ts --rollback --page-id=<id>  # Restore single page
 *   npx tsx scripts/fix-split-urls.ts --rollback-all  # Restore all fixed pages
 *
 * Options:
 *   --page-id=<id>   Process only a specific page
 *   --limit=<n>      Limit the number of pages to process
 *   --env=prod       Force production environment
 *   --verbose        Enable verbose logging
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createHash } from 'crypto';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// ============================================================================
// CLI Parsing
// ============================================================================

interface CLIOptions {
  mode: 'scan-only' | 'dry-run' | 'fix' | 'rollback' | 'rollback-all';
  pageId?: string;
  limit?: number;
  forceProduction: boolean;
  verbose: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  let mode: CLIOptions['mode'] = 'scan-only';
  if (args.includes('--dry-run')) mode = 'dry-run';
  if (args.includes('--fix')) mode = 'fix';
  if (args.includes('--rollback')) mode = 'rollback';
  if (args.includes('--rollback-all')) mode = 'rollback-all';

  const pageIdArg = args.find((a) => a.startsWith('--page-id='));
  const limitArg = args.find((a) => a.startsWith('--limit='));

  return {
    mode,
    pageId: pageIdArg?.split('=')[1],
    limit: limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined,
    forceProduction: args.includes('--env=prod'),
    verbose: args.includes('--verbose'),
  };
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 100;
const BACKUP_COLLECTION = 'contentBackups_splitUrlFix_20260121';

// ============================================================================
// Firebase Admin Initialization
// ============================================================================

function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (keyJson) {
    let credentials;
    try {
      credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(keyJson);
    }

    return admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id,
    });
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(serviceAccountPath);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  throw new Error(
    'No Firebase credentials found. Set GOOGLE_CLOUD_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS'
  );
}

// ============================================================================
// Types
// ============================================================================

interface FixStats {
  pagesScanned: number;
  pagesWithContent: number;
  pagesSkipped: number;
  corruptedPagesFound: number;
  totalCorruptionsFound: number;
  pagesBackedUp: number;
  pagesFixed: number;
  fixesFailed: number;
  validationsPassed: number;
  validationsFailed: number;
  errors: Array<{ pageId: string; error: string; phase: string }>;
  corruptedPages: Array<{
    pageId: string;
    title: string;
    corruptionCount: number;
    corruptions: Array<{
      paragraphIndex: number;
      childIndex: number;
      orphanedPrefix: string;
      linkUrl: string;
      linkDisplayText: string;
    }>;
  }>;
}

interface CorruptionInfo {
  paragraphIndex: number;
  childIndex: number;
  orphanedPrefix: string;
  linkUrl: string;
  linkDisplayText: string;
}

interface DetectionResult {
  isSplit: boolean;
  orphanedPrefix: string | null;
  expectedFullUrl: string | null;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect if a text node followed by a link node represents a split URL.
 * The text node ends with a URL prefix that should be part of the link's display text.
 */
function detectSplitUrl(textNode: any, linkNode: any): DetectionResult {
  const noSplit: DetectionResult = { isSplit: false, orphanedPrefix: null, expectedFullUrl: null };

  // Must have text node followed by link node
  if (!textNode?.text || linkNode?.type !== 'link') {
    return noSplit;
  }

  const text = textNode.text;
  const linkUrl = linkNode.url || '';
  const linkDisplayText = linkNode.children?.[0]?.text || '';

  // Check if text ends with a URL-like prefix
  // Patterns: "https://", "https://www.", "http://", "http://www.", "www."
  // Also allow partial domain like "https://www.exam" followed by link "ple.com"
  const match = text.match(/((?:https?:\/\/(?:www\.)?|www\.)[a-z0-9.-]*)$/i);

  if (!match) {
    return noSplit;
  }

  const orphanedPrefix = match[1];

  // Verify this is actually a split URL:
  // 1. The link URL should be a full URL (starts with http/https)
  // 2. The link's display text should NOT start with the protocol
  //    (indicating the protocol was split off into the text node)
  if (!linkUrl.toLowerCase().startsWith('http')) {
    return noSplit;
  }

  // Check if the display text is missing the protocol that's in the orphaned prefix
  const displayTextLower = linkDisplayText.toLowerCase();
  const orphanedLower = orphanedPrefix.toLowerCase();

  // The orphaned prefix should be the beginning of what the display text is missing
  // Example: orphaned = "https://www." and display = "xtreet.com/dmv"
  // Together they form "https://www.xtreet.com/dmv" which should match the URL
  const combinedText = orphanedPrefix + linkDisplayText;
  const normalizedUrl = linkUrl.replace(/\/$/, ''); // Remove trailing slash for comparison
  const normalizedCombined = combinedText.replace(/\/$/, '').replace(/\s+$/, '');

  // Check if combining them gives us something close to the actual URL
  if (
    normalizedUrl.toLowerCase() === normalizedCombined.toLowerCase() ||
    normalizedUrl.toLowerCase().startsWith(normalizedCombined.toLowerCase())
  ) {
    return {
      isSplit: true,
      orphanedPrefix,
      expectedFullUrl: linkUrl,
    };
  }

  // Also check if the display text doesn't have the protocol but URL does
  if (
    !displayTextLower.startsWith('http') &&
    (orphanedLower.startsWith('http://') || orphanedLower.startsWith('https://'))
  ) {
    // This looks like a split - the protocol is in the text node
    return {
      isSplit: true,
      orphanedPrefix,
      expectedFullUrl: linkUrl,
    };
  }

  return noSplit;
}

/**
 * Scan content for all split URL corruptions
 */
function detectCorruptionsInContent(content: any[]): CorruptionInfo[] {
  const corruptions: CorruptionInfo[] = [];

  if (!Array.isArray(content)) {
    return corruptions;
  }

  content.forEach((node, paragraphIndex) => {
    if (node.type !== 'paragraph' || !Array.isArray(node.children)) {
      return;
    }

    // Check adjacent pairs of children
    for (let i = 0; i < node.children.length - 1; i++) {
      const current = node.children[i];
      const next = node.children[i + 1];

      const detection = detectSplitUrl(current, next);

      if (detection.isSplit && detection.orphanedPrefix) {
        corruptions.push({
          paragraphIndex,
          childIndex: i,
          orphanedPrefix: detection.orphanedPrefix,
          linkUrl: next.url || '',
          linkDisplayText: next.children?.[0]?.text || '',
        });
      }
    }
  });

  return corruptions;
}

// ============================================================================
// Fix Functions
// ============================================================================

/**
 * Fix all split URL corruptions in content
 * Returns a new content array with corruptions fixed
 */
function fixCorruptionsInContent(content: any[]): any[] {
  if (!Array.isArray(content)) {
    return content;
  }

  // Deep clone the content to avoid mutation
  const fixedContent = JSON.parse(JSON.stringify(content));

  for (let pIdx = 0; pIdx < fixedContent.length; pIdx++) {
    const node = fixedContent[pIdx];
    if (node.type !== 'paragraph' || !Array.isArray(node.children)) {
      continue;
    }

    const newChildren: any[] = [];
    let i = 0;

    while (i < node.children.length) {
      const current = node.children[i];
      const next = node.children[i + 1];

      const detection = detectSplitUrl(current, next);

      if (detection.isSplit && detection.orphanedPrefix && next) {
        // Merge the split URL

        // 1. Remove the orphaned prefix from the text node
        const remainingText = current.text.slice(
          0,
          current.text.length - detection.orphanedPrefix.length
        );

        // 2. If there's remaining text, add it as a text node
        if (remainingText.length > 0) {
          newChildren.push({ ...current, text: remainingText });
        }

        // 3. Update the link's display text to include the full URL
        const fixedLink = JSON.parse(JSON.stringify(next));
        if (fixedLink.children && fixedLink.children[0]) {
          fixedLink.children[0].text = detection.expectedFullUrl || fixedLink.url;
        } else {
          fixedLink.children = [{ text: detection.expectedFullUrl || fixedLink.url }];
        }
        newChildren.push(fixedLink);

        // Skip both the text node and link node
        i += 2;
      } else {
        // No split detected, keep the node as-is
        newChildren.push(current);
        i++;
      }
    }

    node.children = newChildren;
  }

  return fixedContent;
}

// ============================================================================
// Validation Functions
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function validateNode(node: any): ValidationResult {
  const errors: string[] = [];

  if (!node) {
    errors.push('Node is null or undefined');
    return { isValid: false, errors };
  }

  if (node.type === 'paragraph') {
    if (!Array.isArray(node.children)) {
      errors.push('Paragraph node missing children array');
    } else {
      node.children.forEach((child: any, index: number) => {
        if (child.type === 'link') {
          if (!child.url) {
            errors.push(`Link at index ${index} missing url`);
          }
          if (!Array.isArray(child.children) || child.children.length === 0) {
            errors.push(`Link at index ${index} missing children`);
          } else if (child.children[0] && typeof child.children[0].text !== 'string') {
            errors.push(`Link at index ${index} has invalid display text`);
          }
        } else if (!('text' in child) && child.type !== 'link') {
          // Allow other node types we might not know about
        }
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}

function validateContent(content: any[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(content)) {
    return { isValid: false, errors: ['Content is not an array'] };
  }

  content.forEach((node, index) => {
    const result = validateNode(node);
    if (!result.isValid) {
      errors.push(`Node ${index}: ${result.errors.join(', ')}`);
    }
  });

  return { isValid: errors.length === 0, errors };
}

function validateJsonRoundtrip(content: any[]): boolean {
  try {
    const serialized = JSON.stringify(content);
    const deserialized = JSON.parse(serialized);
    return Array.isArray(deserialized);
  } catch {
    return false;
  }
}

// ============================================================================
// Backup Functions
// ============================================================================

async function createBackup(
  db: FirebaseFirestore.Firestore,
  pageId: string,
  content: any[],
  dryRun: boolean
): Promise<boolean> {
  const originalContentStr = JSON.stringify(content);
  const hash = createHash('sha256').update(originalContentStr).digest('hex');

  const backup = {
    pageId,
    originalContent: originalContentStr,
    backedUpAt: new Date().toISOString(),
    contentHash: hash,
  };

  if (!dryRun) {
    await db.collection(BACKUP_COLLECTION).doc(pageId).set(backup);
  }

  return true;
}

async function restoreFromBackup(
  db: FirebaseFirestore.Firestore,
  pageId: string,
  pagesCollection: string
): Promise<boolean> {
  const backupDoc = await db.collection(BACKUP_COLLECTION).doc(pageId).get();

  if (!backupDoc.exists) {
    console.error(`No backup found for page ${pageId}`);
    return false;
  }

  const backup = backupDoc.data()!;
  const content = JSON.parse(backup.originalContent);

  await db.collection(pagesCollection).doc(pageId).update({ content });

  console.log(`   ✅ Restored page ${pageId} from backup`);
  return true;
}

// ============================================================================
// Content Parsing
// ============================================================================

function parseContent(rawContent: any): any[] | null {
  if (!rawContent) return null;

  try {
    if (typeof rawContent === 'string') {
      return JSON.parse(rawContent);
    } else if (Array.isArray(rawContent)) {
      return rawContent;
    }
  } catch {
    return null;
  }

  return null;
}

// ============================================================================
// Main Workflow Functions
// ============================================================================

function initStats(): FixStats {
  return {
    pagesScanned: 0,
    pagesWithContent: 0,
    pagesSkipped: 0,
    corruptedPagesFound: 0,
    totalCorruptionsFound: 0,
    pagesBackedUp: 0,
    pagesFixed: 0,
    fixesFailed: 0,
    validationsPassed: 0,
    validationsFailed: 0,
    errors: [],
    corruptedPages: [],
  };
}

async function scanForCorruption(
  db: FirebaseFirestore.Firestore,
  pagesCollection: string,
  stats: FixStats,
  options: CLIOptions
): Promise<void> {
  console.log('\n📊 Scanning for corrupted pages...\n');

  // If specific page ID is provided, only scan that page
  if (options.pageId) {
    const doc = await db.collection(pagesCollection).doc(options.pageId).get();
    if (!doc.exists) {
      console.log(`   Page ${options.pageId} not found`);
      return;
    }

    stats.pagesScanned = 1;
    const data = doc.data()!;

    if (data.deleted) {
      stats.pagesSkipped = 1;
      console.log(`   Page ${options.pageId} is deleted`);
      return;
    }

    const content = parseContent(data.content);
    if (!content) {
      stats.pagesSkipped = 1;
      console.log(`   Page ${options.pageId} has no valid content`);
      return;
    }

    stats.pagesWithContent = 1;
    const corruptions = detectCorruptionsInContent(content);

    if (corruptions.length > 0) {
      stats.corruptedPagesFound = 1;
      stats.totalCorruptionsFound = corruptions.length;
      stats.corruptedPages.push({
        pageId: doc.id,
        title: data.title || 'Untitled',
        corruptionCount: corruptions.length,
        corruptions,
      });

      console.log(`   ⚠️  ${doc.id}: "${data.title}" - ${corruptions.length} corruption(s)`);
      corruptions.forEach((c) => {
        console.log(
          `      Paragraph ${c.paragraphIndex}, child ${c.childIndex}: "${c.orphanedPrefix}" + "${c.linkDisplayText}"`
        );
        console.log(`      Link URL: ${c.linkUrl}`);
      });
    } else {
      console.log(`   ✅ Page ${options.pageId} has no corruptions`);
    }

    return;
  }

  // Scan all pages
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let batchNumber = 0;

  while (true) {
    batchNumber++;
    process.stdout.write(`   Batch ${batchNumber}...`);

    let query = db.collection(pagesCollection).orderBy('createdAt', 'desc').limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(' done.');
      break;
    }

    let batchCorruptions = 0;

    for (const doc of snapshot.docs) {
      stats.pagesScanned++;

      const data = doc.data();
      if (data.deleted) {
        stats.pagesSkipped++;
        continue;
      }

      const content = parseContent(data.content);
      if (!content) {
        stats.pagesSkipped++;
        continue;
      }

      stats.pagesWithContent++;

      const corruptions = detectCorruptionsInContent(content);

      if (corruptions.length > 0) {
        stats.corruptedPagesFound++;
        stats.totalCorruptionsFound += corruptions.length;
        batchCorruptions += corruptions.length;

        stats.corruptedPages.push({
          pageId: doc.id,
          title: data.title || 'Untitled',
          corruptionCount: corruptions.length,
          corruptions,
        });

        if (options.verbose) {
          console.log(`\n      ⚠️  ${doc.id}: "${data.title}" - ${corruptions.length} corruption(s)`);
          corruptions.forEach((c) => {
            console.log(
              `         Paragraph ${c.paragraphIndex}, child ${c.childIndex}: "${c.orphanedPrefix}" + "${c.linkDisplayText}"`
            );
          });
        }
      }
    }

    console.log(
      ` scanned ${snapshot.docs.length} pages${batchCorruptions > 0 ? `, found ${batchCorruptions} corruptions` : ''}`
    );

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (options.limit && stats.pagesScanned >= options.limit) {
      console.log(`   Reached limit of ${options.limit} pages`);
      break;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function processPages(
  db: FirebaseFirestore.Firestore,
  pagesCollection: string,
  stats: FixStats,
  options: CLIOptions,
  dryRun: boolean
): Promise<void> {
  // First, scan for corruption
  await scanForCorruption(db, pagesCollection, stats, options);

  if (stats.corruptedPagesFound === 0) {
    console.log('\n✅ No corrupted pages found. Nothing to fix.');
    return;
  }

  console.log(
    `\n🔧 ${dryRun ? '[DRY RUN] ' : ''}Fixing ${stats.corruptedPagesFound} corrupted pages...\n`
  );

  for (const corruptedPage of stats.corruptedPages) {
    try {
      // Get the current page data
      const pageDoc = await db.collection(pagesCollection).doc(corruptedPage.pageId).get();
      if (!pageDoc.exists) {
        stats.errors.push({
          pageId: corruptedPage.pageId,
          error: 'Page no longer exists',
          phase: 'fix',
        });
        continue;
      }

      const data = pageDoc.data()!;
      const content = parseContent(data.content);

      if (!content) {
        stats.errors.push({
          pageId: corruptedPage.pageId,
          error: 'Could not parse content',
          phase: 'fix',
        });
        continue;
      }

      // Create backup before fixing
      if (!dryRun) {
        await createBackup(db, corruptedPage.pageId, content, false);
        stats.pagesBackedUp++;
      }

      // Fix the content
      const fixedContent = fixCorruptionsInContent(content);

      // Validate the fixed content
      const validation = validateContent(fixedContent);
      if (!validation.isValid) {
        stats.validationsFailed++;
        stats.errors.push({
          pageId: corruptedPage.pageId,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          phase: 'validate',
        });
        continue;
      }

      // Validate JSON roundtrip
      if (!validateJsonRoundtrip(fixedContent)) {
        stats.validationsFailed++;
        stats.errors.push({
          pageId: corruptedPage.pageId,
          error: 'JSON roundtrip validation failed',
          phase: 'validate',
        });
        continue;
      }

      stats.validationsPassed++;

      // Apply the fix
      if (!dryRun) {
        await db.collection(pagesCollection).doc(corruptedPage.pageId).update({
          content: fixedContent,
          lastModified: new Date().toISOString(),
        });
      }

      stats.pagesFixed++;
      console.log(
        `   ${dryRun ? '[DRY RUN] Would fix' : '✅ Fixed'}: ${corruptedPage.pageId} - "${corruptedPage.title}"`
      );

      if (options.verbose) {
        corruptedPage.corruptions.forEach((c) => {
          console.log(`      Fixed: "${c.orphanedPrefix}" + "${c.linkDisplayText}" → "${c.linkUrl}"`);
        });
      }
    } catch (error: any) {
      stats.fixesFailed++;
      stats.errors.push({
        pageId: corruptedPage.pageId,
        error: error.message,
        phase: 'fix',
      });
    }
  }
}

async function rollbackPage(
  db: FirebaseFirestore.Firestore,
  pagesCollection: string,
  pageId: string
): Promise<void> {
  console.log(`\n🔄 Rolling back page ${pageId}...`);
  const success = await restoreFromBackup(db, pageId, pagesCollection);
  if (!success) {
    console.log(`   ❌ Failed to rollback page ${pageId}`);
  }
}

async function rollbackAllPages(
  db: FirebaseFirestore.Firestore,
  pagesCollection: string
): Promise<void> {
  console.log('\n🔄 Rolling back all fixed pages...\n');

  const backups = await db.collection(BACKUP_COLLECTION).get();

  if (backups.empty) {
    console.log('   No backups found.');
    return;
  }

  let restored = 0;
  let failed = 0;

  for (const backup of backups.docs) {
    const pageId = backup.id;
    const success = await restoreFromBackup(db, pageId, pagesCollection);
    if (success) {
      restored++;
    } else {
      failed++;
    }
  }

  console.log(`\n   Restored: ${restored}, Failed: ${failed}`);
}

// ============================================================================
// Results Reporting
// ============================================================================

function printResults(stats: FixStats, options: CLIOptions): void {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Mode:                      ${options.mode.toUpperCase()}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(`   Pages scanned:             ${stats.pagesScanned}`);
  console.log(`   Pages with content:        ${stats.pagesWithContent}`);
  console.log(`   Pages skipped:             ${stats.pagesSkipped}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(`   Corrupted pages found:     ${stats.corruptedPagesFound}`);
  console.log(`   Total corruptions:         ${stats.totalCorruptionsFound}`);
  console.log('────────────────────────────────────────────────────────────');

  if (options.mode !== 'scan-only') {
    console.log(`   Pages backed up:           ${stats.pagesBackedUp}`);
    console.log(`   Pages fixed:               ${stats.pagesFixed}`);
    console.log(`   Fixes failed:              ${stats.fixesFailed}`);
    console.log(`   Validations passed:        ${stats.validationsPassed}`);
    console.log(`   Validations failed:        ${stats.validationsFailed}`);
  }

  console.log(`   Errors:                    ${stats.errors.length}`);
  console.log('════════════════════════════════════════════════════════════');

  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    stats.errors.forEach((e) => {
      console.log(`   ${e.pageId} (${e.phase}): ${e.error}`);
    });
  }

  if (stats.corruptedPagesFound > 0 && options.mode === 'scan-only') {
    console.log('\n📋 CORRUPTED PAGES:');
    stats.corruptedPages.forEach((p) => {
      console.log(`   ${p.pageId}: "${p.title}" (${p.corruptionCount} issues)`);
    });
    console.log('\n💡 Next steps:');
    console.log('   1. Review the corrupted pages above');
    console.log('   2. Run with --dry-run to see what would be fixed');
    console.log('   3. Run with --fix to apply the fixes');
  }

  if (options.mode === 'dry-run') {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run with --fix to apply changes.\n');
  } else if (options.mode === 'fix' && stats.pagesFixed > 0) {
    console.log(`\n✅ Fixed ${stats.pagesFixed} pages.`);
    console.log(`   Backups stored in collection: ${BACKUP_COLLECTION}`);
    console.log('   Use --rollback --page-id=<id> to restore if needed.\n');
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('     FIX SPLIT URLs MIGRATION');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Mode: ${options.mode.toUpperCase()}`);

  const app = initFirebase();
  const db = app.firestore();

  const isProduction =
    options.forceProduction || process.env.NODE_ENV === 'production' || !process.env.VERCEL_ENV;
  const collectionPrefix = isProduction ? '' : 'DEV_';
  const PAGES_COLLECTION = `${collectionPrefix}pages`;

  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Pages collection: ${PAGES_COLLECTION}`);
  if (options.pageId) {
    console.log(`Page ID: ${options.pageId}`);
  }
  if (options.limit) {
    console.log(`Limit: ${options.limit}`);
  }

  const stats = initStats();

  switch (options.mode) {
    case 'scan-only':
      await scanForCorruption(db, PAGES_COLLECTION, stats, options);
      break;

    case 'dry-run':
      await processPages(db, PAGES_COLLECTION, stats, options, true);
      break;

    case 'fix':
      await processPages(db, PAGES_COLLECTION, stats, options, false);
      break;

    case 'rollback':
      if (!options.pageId) {
        console.error('Error: --page-id required for rollback');
        process.exit(1);
      }
      await rollbackPage(db, PAGES_COLLECTION, options.pageId);
      break;

    case 'rollback-all':
      await rollbackAllPages(db, PAGES_COLLECTION);
      break;
  }

  if (options.mode !== 'rollback' && options.mode !== 'rollback-all') {
    printResults(stats, options);
  }

  process.exit(stats.errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
