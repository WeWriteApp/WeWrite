/**
 * Efficient Backlinks System
 * 
 * This system precomputes and indexes backlinks for fast retrieval.
 * Instead of scanning through all pages on every request, we maintain
 * an index that gets updated when pages are saved.
 */

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config';
import { extractLinksFromNodes } from './links';

export interface BacklinkEntry {
  id: string;
  sourcePageId: string;
  sourcePageTitle: string;
  sourceUsername: string;
  targetPageId: string;
  linkText: string;
  linkUrl: string;
  createdAt: any;
  lastModified: any;
  isPublic: boolean;
}

export interface BacklinkSummary {
  id: string;
  title: string;
  username: string;
  lastModified: any;
  isPublic: boolean;
  linkText?: string;
}

/**
 * Get all backlinks for a page (fast index-based lookup)
 */
export async function getBacklinks(
  targetPageId: string, 
  limit?: number
): Promise<BacklinkSummary[]> {
  try {
    console.log(`🔍 Getting backlinks for page ${targetPageId} (limit: ${limit || 'none'})`);
    
    // Query the backlinks index
    let backlinksQuery = query(
      collection(db, 'backlinks'),
      where('targetPageId', '==', targetPageId),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc')
    );
    
    if (limit) {
      backlinksQuery = query(backlinksQuery, firestoreLimit(limit));
    }
    
    const snapshot = await getDocs(backlinksQuery);
    
    const backlinks: BacklinkSummary[] = snapshot.docs.map(doc => {
      const data = doc.data() as BacklinkEntry;
      return {
        id: data.sourcePageId,
        title: data.sourcePageTitle,
        username: data.sourceUsername,
        lastModified: data.lastModified,
        isPublic: data.isPublic,
        linkText: data.linkText
      };
    });
    
    console.log(`✅ Found ${backlinks.length} backlinks for page ${targetPageId}`);
    return backlinks;
    
  } catch (error) {
    console.error('Error getting backlinks:', error);

    // If the error is due to index building, provide a fallback
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.log('🔄 Backlinks index is building, using fallback method');

      try {
        // Fallback: Use the old findBacklinks method from links.ts
        const { findBacklinks } = await import('./links');
        const fallbackResults = await findBacklinks(targetPageId, limit || 20);

        // Convert to BacklinkSummary format
        return fallbackResults.map(result => ({
          id: result.id,
          title: result.title,
          username: result.username || '',
          lastModified: result.lastModified,
          isPublic: result.isPublic,
          linkText: undefined // Not available in fallback
        }));
      } catch (fallbackError) {
        console.error('Fallback backlinks method also failed:', fallbackError);
        return [];
      }
    }

    return [];
  }
}

/**
 * Update backlinks index when a page is saved
 */
export async function updateBacklinksIndex(
  pageId: string,
  pageTitle: string,
  username: string,
  content: any[],
  isPublic: boolean,
  lastModified: any
): Promise<void> {
  try {
    console.log(`🔄 Updating backlinks index for page ${pageId}`);
    
    // First, remove all existing backlinks from this page
    await removeBacklinksFromPage(pageId);
    
    // Extract links from the page content
    const links = extractLinksFromNodes(content);
    const pageLinks = links.filter(link => link.type === 'page' && link.pageId);
    
    if (pageLinks.length === 0) {
      console.log(`📝 No page links found in ${pageId}, backlinks index updated`);
      return;
    }
    
    // Create batch for efficient writes
    const batch = writeBatch(db);
    
    // Add new backlink entries
    for (const link of pageLinks) {
      const backlinkId = `${pageId}_to_${link.pageId}`;
      const backlinkRef = doc(db, 'backlinks', backlinkId);
      
      const backlinkEntry: BacklinkEntry = {
        id: backlinkId,
        sourcePageId: pageId,
        sourcePageTitle: pageTitle,
        sourceUsername: username,
        targetPageId: link.pageId,
        linkText: link.text || '',
        linkUrl: link.url || '',
        createdAt: serverTimestamp(),
        lastModified: lastModified,
        isPublic: isPublic
      };
      
      batch.set(backlinkRef, backlinkEntry);
    }
    
    // Commit the batch
    await batch.commit();
    
    console.log(`✅ Updated backlinks index: ${pageLinks.length} links from page ${pageId}`);
    
  } catch (error) {
    console.error('Error updating backlinks index:', error);
    throw error;
  }
}

/**
 * Remove all backlinks from a specific source page
 */
export async function removeBacklinksFromPage(sourcePageId: string): Promise<void> {
  try {
    const backlinksQuery = query(
      collection(db, 'backlinks'),
      where('sourcePageId', '==', sourcePageId)
    );
    
    const snapshot = await getDocs(backlinksQuery);
    
    if (snapshot.empty) {
      return;
    }
    
    // Create batch for efficient deletes
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`🗑️ Removed ${snapshot.docs.length} backlinks from page ${sourcePageId}`);
    
  } catch (error) {
    console.error('Error removing backlinks from page:', error);
    throw error;
  }
}

/**
 * Remove a specific page from the backlinks index (when page is deleted)
 */
export async function removePageFromBacklinksIndex(pageId: string): Promise<void> {
  try {
    console.log(`🗑️ Removing page ${pageId} from backlinks index`);
    
    // Remove backlinks FROM this page
    await removeBacklinksFromPage(pageId);
    
    // Remove backlinks TO this page
    const backlinksToPageQuery = query(
      collection(db, 'backlinks'),
      where('targetPageId', '==', pageId)
    );
    
    const snapshot = await getDocs(backlinksToPageQuery);
    
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      console.log(`🗑️ Removed ${snapshot.docs.length} backlinks to page ${pageId}`);
    }
    
  } catch (error) {
    console.error('Error removing page from backlinks index:', error);
    throw error;
  }
}

/**
 * Get backlinks count for a page (fast)
 */
export async function getBacklinksCount(targetPageId: string): Promise<number> {
  try {
    const backlinksQuery = query(
      collection(db, 'backlinks'),
      where('targetPageId', '==', targetPageId),
      where('isPublic', '==', true)
    );
    
    const snapshot = await getDocs(backlinksQuery);
    return snapshot.size;
    
  } catch (error) {
    console.error('Error getting backlinks count:', error);
    return 0;
  }
}

/**
 * Update backlink visibility when page privacy changes
 */
export async function updateBacklinkVisibility(
  pageId: string, 
  isPublic: boolean
): Promise<void> {
  try {
    console.log(`🔄 Updating backlink visibility for page ${pageId} to ${isPublic ? 'public' : 'private'}`);
    
    const backlinksQuery = query(
      collection(db, 'backlinks'),
      where('sourcePageId', '==', pageId)
    );
    
    const snapshot = await getDocs(backlinksQuery);
    
    if (snapshot.empty) {
      return;
    }
    
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isPublic });
    });
    
    await batch.commit();
    
    console.log(`✅ Updated visibility for ${snapshot.docs.length} backlinks from page ${pageId}`);
    
  } catch (error) {
    console.error('Error updating backlink visibility:', error);
    throw error;
  }
}
