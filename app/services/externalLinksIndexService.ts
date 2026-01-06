/**
 * External Links Index Service
 *
 * This system precomputes and indexes external links for fast retrieval.
 * Instead of scanning through all pages on every request (O(n)),
 * we maintain an index that gets updated when pages are saved (O(1) lookup).
 *
 * ## How It Works
 *
 * 1. When a page is saved, we extract all external links from the content
 * 2. We create index entries in the `externalLinks` collection
 * 3. Queries for "pages linking to URL X" now query this index instead of scanning all pages
 *
 * ## Index Schema
 *
 * Each entry in the `externalLinks` collection contains:
 * - id: `${pageId}_${urlHash}` (unique per page/url combination)
 * - url: Full external URL
 * - domain: Extracted domain for domain-level queries
 * - pageId: Source page ID
 * - pageTitle: Source page title
 * - userId: Page owner's user ID
 * - username: Page owner's username
 * - linkText: Display text of the link
 * - createdAt: When the link was first indexed
 * - lastModified: Last modification timestamp
 * - isPublic: Whether the source page is public
 *
 * ## Required Firestore Indexes
 *
 * The following composite indexes are needed:
 * 1. url (==), isPublic (==), lastModified (desc)
 * 2. domain (==), isPublic (==), lastModified (desc)
 * 3. userId (==), url (==), lastModified (desc)
 * 4. userId (==), domain (==), lastModified (desc)
 * 5. pageId (==) [for deletion queries]
 *
 * ## Backfill
 *
 * For existing pages, run: `npx tsx scripts/backfill-external-links.ts`
 *
 * @see docs/features/EXTERNAL_LINKS_INDEX.md for full documentation
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../utils/environmentConfig';
import { extractLinksFromNodes, extractDomainFromUrl } from '../firebase/database/links';
import type { EditorContent } from '../types/database';

/**
 * External link index entry stored in Firestore
 */
export interface ExternalLinkEntry {
  id: string;
  url: string;
  domain: string | null;
  pageId: string;
  pageTitle: string;
  userId: string;
  username: string;
  linkText: string;
  createdAt: string;
  lastModified: string;
  isPublic: boolean;
}

/**
 * Result from querying external links by URL or domain
 */
export interface ExternalLinkQueryResult {
  id: string;
  title: string;
  username?: string;
  lastModified: string;
  matchType: 'exact' | 'partial';
  matchedUrl?: string;
}

/**
 * Create a hash-like identifier from a URL for use in document IDs
 * Uses simple string hashing to keep IDs manageable length
 */
function createUrlHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to base36 for shorter string, ensure positive
  return Math.abs(hash).toString(36);
}

/**
 * Extract external links from content nodes
 * Returns only truly external links (not WeWrite internal links)
 */
export function extractExternalLinksFromContent(content: EditorContent): Array<{
  url: string;
  text: string;
  domain: string | null;
}> {
  const links = extractLinksFromNodes(content);

  return links
    .filter(link => {
      if (link.type !== 'external') return false;
      if (!link.url) return false;

      const url = link.url.toLowerCase();

      // Must have a protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

      // Must not be a WeWrite domain
      if (url.includes('wewrite.app') || url.includes('localhost:3000') || url.includes('localhost')) return false;

      return true;
    })
    .map(link => ({
      url: link.url!,
      text: link.text || link.url!,
      domain: extractDomainFromUrl(link.url!)
    }));
}

/**
 * Update external links index when a page is saved (server-side only)
 *
 * This function:
 * 1. Removes all existing external link entries for the page
 * 2. Extracts external links from the new content
 * 3. Creates new index entries for each external link
 */
export async function updateExternalLinksIndex(
  pageId: string,
  pageTitle: string,
  userId: string,
  username: string,
  content: EditorContent,
  isPublic: boolean,
  lastModified: string
): Promise<{ indexed: number; removed: number }> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    // Step 1: Remove existing entries for this page
    const existingQuery = db.collection(collectionName)
      .where('pageId', '==', pageId);
    const existingSnapshot = await existingQuery.get();

    const batch = db.batch();
    let removed = 0;

    existingSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      removed++;
    });

    // Step 2: Extract external links from content
    const externalLinks = extractExternalLinksFromContent(content);

    // Step 3: Create new index entries
    const now = new Date().toISOString();
    let indexed = 0;

    // Deduplicate by URL (same page can't have duplicate entries for same URL)
    const seenUrls = new Set<string>();

    for (const link of externalLinks) {
      if (seenUrls.has(link.url)) continue;
      seenUrls.add(link.url);

      const urlHash = createUrlHash(link.url);
      const entryId = `${pageId}_${urlHash}`;

      const entry: ExternalLinkEntry = {
        id: entryId,
        url: link.url,
        domain: link.domain,
        pageId,
        pageTitle,
        userId,
        username,
        linkText: link.text,
        createdAt: now,
        lastModified,
        isPublic
      };

      const docRef = db.collection(collectionName).doc(entryId);
      batch.set(docRef, entry);
      indexed++;
    }

    // Commit the batch
    await batch.commit();

    return { indexed, removed };

  } catch (error) {
    console.error('[ExternalLinksIndex] Error updating index:', error);
    throw error;
  }
}

/**
 * Remove all external link entries for a page (when page is deleted)
 */
export async function removeExternalLinksForPage(pageId: string): Promise<number> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    const query = db.collection(collectionName)
      .where('pageId', '==', pageId);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;

  } catch (error) {
    console.error('[ExternalLinksIndex] Error removing entries:', error);
    throw error;
  }
}

/**
 * Find pages linking to a specific external URL using the index
 * Returns both exact matches and domain-level matches
 */
export async function findPagesLinkingToExternalUrlIndexed(
  externalUrl: string,
  limitCount: number = 10
): Promise<ExternalLinkQueryResult[]> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    const targetDomain = extractDomainFromUrl(externalUrl);

    // Query 1: Exact URL matches
    const exactQuery = db.collection(collectionName)
      .where('url', '==', externalUrl)
      .where('isPublic', '==', true)
      .orderBy('lastModified', 'desc')
      .limit(limitCount);

    const exactSnapshot = await exactQuery.get();

    const exactMatches: ExternalLinkQueryResult[] = exactSnapshot.docs.map(doc => {
      const data = doc.data() as ExternalLinkEntry;
      return {
        id: data.pageId,
        title: data.pageTitle,
        username: data.username,
        lastModified: data.lastModified,
        matchType: 'exact' as const
      };
    });

    // Query 2: Domain matches (if we have a valid domain)
    const partialMatches: ExternalLinkQueryResult[] = [];

    if (targetDomain) {
      const domainQuery = db.collection(collectionName)
        .where('domain', '==', targetDomain)
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 2); // Get more since we'll filter out exact matches

      const domainSnapshot = await domainQuery.get();

      // Filter out exact matches and deduplicate by pageId
      const exactPageIds = new Set(exactMatches.map(m => m.id));
      const seenPageIds = new Set<string>();

      for (const doc of domainSnapshot.docs) {
        const data = doc.data() as ExternalLinkEntry;

        // Skip if this page already has an exact match
        if (exactPageIds.has(data.pageId)) continue;

        // Skip duplicates (same page, different URLs on same domain)
        if (seenPageIds.has(data.pageId)) continue;
        seenPageIds.add(data.pageId);

        // Skip the exact URL (it's in exact matches)
        if (data.url === externalUrl) continue;

        partialMatches.push({
          id: data.pageId,
          title: data.pageTitle,
          username: data.username,
          lastModified: data.lastModified,
          matchType: 'partial' as const,
          matchedUrl: data.url
        });
      }
    }

    // Combine results: exact matches first, then partial matches
    return [...exactMatches, ...partialMatches].slice(0, limitCount);

  } catch (error) {
    console.error('[ExternalLinksIndex] Error querying index:', error);
    // Return empty array on error - caller should fall back to old method if needed
    return [];
  }
}

/**
 * Find pages by a specific user linking to an external URL using the index
 */
export async function findUserPagesLinkingToExternalUrlIndexed(
  externalUrl: string,
  userId: string
): Promise<ExternalLinkQueryResult[]> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    const targetDomain = extractDomainFromUrl(externalUrl);

    // Query 1: Exact URL matches for this user
    const exactQuery = db.collection(collectionName)
      .where('userId', '==', userId)
      .where('url', '==', externalUrl)
      .orderBy('lastModified', 'desc');

    const exactSnapshot = await exactQuery.get();

    const exactMatches: ExternalLinkQueryResult[] = exactSnapshot.docs.map(doc => {
      const data = doc.data() as ExternalLinkEntry;
      return {
        id: data.pageId,
        title: data.pageTitle,
        username: data.username,
        lastModified: data.lastModified,
        matchType: 'exact' as const
      };
    });

    // Query 2: Domain matches for this user
    const partialMatches: ExternalLinkQueryResult[] = [];

    if (targetDomain) {
      const domainQuery = db.collection(collectionName)
        .where('userId', '==', userId)
        .where('domain', '==', targetDomain)
        .orderBy('lastModified', 'desc');

      const domainSnapshot = await domainQuery.get();

      const exactPageIds = new Set(exactMatches.map(m => m.id));
      const seenPageIds = new Set<string>();

      for (const doc of domainSnapshot.docs) {
        const data = doc.data() as ExternalLinkEntry;

        if (exactPageIds.has(data.pageId)) continue;
        if (seenPageIds.has(data.pageId)) continue;
        seenPageIds.add(data.pageId);

        if (data.url === externalUrl) continue;

        partialMatches.push({
          id: data.pageId,
          title: data.pageTitle,
          username: data.username,
          lastModified: data.lastModified,
          matchType: 'partial' as const,
          matchedUrl: data.url
        });
      }
    }

    return [...exactMatches, ...partialMatches];

  } catch (error) {
    console.error('[ExternalLinksIndex] Error querying user index:', error);
    return [];
  }
}

/**
 * Get global count of pages linking to a specific URL using the index
 */
export async function getGlobalExternalLinkCountIndexed(externalUrl: string): Promise<number> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    const query = db.collection(collectionName)
      .where('url', '==', externalUrl)
      .where('isPublic', '==', true);

    const snapshot = await query.get();
    return snapshot.size;

  } catch (error) {
    console.error('[ExternalLinksIndex] Error getting count:', error);
    return 0;
  }
}

/**
 * Get global counts for multiple URLs efficiently
 */
export async function getGlobalExternalLinkCountsIndexed(
  urls: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  urls.forEach(url => counts.set(url, 0));

  if (urls.length === 0) return counts;

  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    // Firestore 'in' queries are limited to 30 values
    const batchSize = 30;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      const query = db.collection(collectionName)
        .where('url', 'in', batch)
        .where('isPublic', '==', true);

      const snapshot = await query.get();

      snapshot.docs.forEach(doc => {
        const data = doc.data() as ExternalLinkEntry;
        const currentCount = counts.get(data.url) || 0;
        counts.set(data.url, currentCount + 1);
      });
    }

    return counts;

  } catch (error) {
    console.error('[ExternalLinksIndex] Error getting batch counts:', error);
    return counts;
  }
}

/**
 * Statistics about the external links index
 */
export interface ExternalLinksIndexStats {
  totalEntries: number;
  uniqueDomains: number;
  topDomains: Array<{ domain: string; count: number }>;
}

/**
 * Get statistics about the external links index
 */
export async function getExternalLinksIndexStats(): Promise<ExternalLinksIndexStats> {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName(COLLECTIONS.EXTERNAL_LINKS);

  try {
    const snapshot = await db.collection(collectionName).get();

    const domainCounts = new Map<string, number>();

    snapshot.docs.forEach(doc => {
      const data = doc.data() as ExternalLinkEntry;
      if (data.domain) {
        const count = domainCounts.get(data.domain) || 0;
        domainCounts.set(data.domain, count + 1);
      }
    });

    // Sort domains by count
    const sortedDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return {
      totalEntries: snapshot.size,
      uniqueDomains: domainCounts.size,
      topDomains: sortedDomains
    };

  } catch (error) {
    console.error('[ExternalLinksIndex] Error getting stats:', error);
    return {
      totalEntries: 0,
      uniqueDomains: 0,
      topDomains: []
    };
  }
}
