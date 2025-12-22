/**
 * Page Link Service
 *
 * Handles updating links across pages when page titles change.
 * Extracted from app/api/pages/route.ts for better modularity.
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';

/**
 * TITLE PROPAGATION SYSTEM
 *
 * When a page title changes, this system updates all links to that page:
 * - Auto-generated links (isCustomText: false): Update display text to new title
 * - Custom text links (isCustomText: true): Keep custom text, only update pageTitle reference
 */

/**
 * Helper function to update links in content recursively
 */
export function updateLinksInContent(content: any, targetPageId: string, oldTitle: string, newTitle: string): any {
  if (!content) return content;

  if (Array.isArray(content)) {
    return content.map(item => updateLinksInContent(item, targetPageId, oldTitle, newTitle));
  }

  if (typeof content === 'object' && content !== null) {
    // Check if this is a link node that references our target page
    if (content.type === 'link' && content.pageId === targetPageId) {
      // Determine if this link has custom text
      // Legacy links might not have isCustomText flag, so we check multiple indicators
      const hasCustomText = content.isCustomText === true ||
        (content.customText && content.customText !== content.pageTitle);

      // Get current display text
      const currentDisplayText = content.children?.[0]?.text || content.displayText || '';

      // For auto-generated links, update the display text
      // For custom text links, keep the display text but update pageTitle reference
      if (!hasCustomText) {
        // Auto-generated link - update display text to new title
        return {
          ...content,
          pageTitle: newTitle,
          // Also update these legacy fields for backwards compatibility
          originalPageTitle: newTitle,
          displayText: newTitle,
          children: [{ text: newTitle }],
          // Explicitly mark as not custom text
          isCustomText: false
        };
      } else {
        // Custom text link - only update pageTitle reference, keep display text
        return {
          ...content,
          pageTitle: newTitle,
          originalPageTitle: newTitle,
          // Keep existing isCustomText, customText, and children unchanged
        };
      }
    }

    // Recursively update nested objects
    const updated: any = {};
    for (const [key, value] of Object.entries(content)) {
      updated[key] = updateLinksInContent(value, targetPageId, oldTitle, newTitle);
    }
    return updated;
  }

  return content;
}

/**
 * OPTIMIZED SOLUTION: Update all links to a page when its title changes
 * Uses backlinks index to find only pages that actually link to this page
 * This avoids the O(n) scan of all pages in the database
 */
export async function updateAllLinksToPage(pageId: string, oldTitle: string, newTitle: string) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const collectionName = getCollectionName('pages');

    // OPTIMIZATION: Use backlinks collection to find pages that link to this page
    // This is O(k) where k is the number of incoming links, instead of O(n) for all pages
    const backlinksSnapshot = await db.collection(getCollectionName('backlinks'))
      .where('targetPageId', '==', pageId)
      .limit(500) // Safety limit - if a page has >500 incoming links, we process in batches
      .get();

    // Extract unique source page IDs from backlinks
    const sourcePageIds = [...new Set(backlinksSnapshot.docs.map(doc => doc.data().sourcePageId))];

    if (sourcePageIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    // Fetch all source pages in batches (Firestore getAll has a limit of 10)
    const batch = db.batch();
    let updatedCount = 0;
    let checkedCount = 0;

    // Process in chunks of 10 (Firestore getAll limit)
    const chunkSize = 10;
    for (let i = 0; i < sourcePageIds.length; i += chunkSize) {
      const chunk = sourcePageIds.slice(i, i + chunkSize);
      const pageRefs = chunk.map(id => db.collection(collectionName).doc(id));
      const pageDocs = await db.getAll(...pageRefs);

      for (const pageDoc of pageDocs) {
        if (!pageDoc.exists) continue;

        // Skip the page being updated (shouldn't happen with backlinks, but safety check)
        if (pageDoc.id === pageId) continue;

        const pageData = pageDoc.data();

        // Skip deleted pages
        if (pageData?.deleted === true) continue;

        if (!pageData?.content) continue;

        checkedCount++;

        // Parse content if it's stored as a string
        let contentArray: any[];
        try {
          contentArray = typeof pageData.content === 'string'
            ? JSON.parse(pageData.content)
            : pageData.content;

          if (!Array.isArray(contentArray)) {
            continue;
          }
        } catch {
          continue;
        }

        // Quick check if this page even references the target pageId
        const contentString = JSON.stringify(contentArray);
        if (!contentString.includes(pageId)) {
          continue; // Skip pages that don't reference this page at all
        }

        // Update links in the content
        const updatedContent = updateLinksInContent(contentArray, pageId, oldTitle, newTitle);

        // Check if anything actually changed
        const updatedString = JSON.stringify(updatedContent);
        if (updatedString !== contentString) {
          // Store in same format as original
          const contentToSave = typeof pageData.content === 'string'
            ? updatedString
            : updatedContent;

          batch.update(pageDoc.ref, {
            content: contentToSave,
            lastModified: new Date().toISOString()
          });
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    return { success: true, updatedCount };

  } catch (error) {
    return { success: false, error };
  }
}
