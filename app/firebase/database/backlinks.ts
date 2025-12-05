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
  getDoc,
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
import { getCollectionName } from '../../utils/environmentConfig';

// Helper function to get the appropriate database instance
function getDatabase() {
  // Check if we're running on the server (Node.js environment)
  if (typeof window === 'undefined') {
    try {
      // Use Firebase Admin SDK on server
      const { getFirebaseAdmin } = require('../admin');
      const admin = getFirebaseAdmin();
      return admin.firestore();
    } catch (error) {
      console.warn('Firebase Admin not available, falling back to client SDK:', error.message);
      return db;
    }
  }
  // Use client SDK in browser
  return db;
}

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
      collection(db, getCollectionName('backlinks')),
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
    console.log(`🔄 [BACKLINKS] Updating backlinks index for page ${pageId}`);
    console.log(`🔄 [BACKLINKS] Page details:`, {
      pageId,
      pageTitle,
      username,
      isPublic,
      contentType: typeof content,
      contentLength: Array.isArray(content) ? content.length : 'not array',
      environment: getCollectionName('backlinks'),
      isServer: typeof window === 'undefined'
    });

    // Get the appropriate database instance (Admin SDK on server, client SDK in browser)
    const database = getDatabase();
    const isServerSide = typeof window === 'undefined';

    // First, remove all existing backlinks from this page
    await removeBacklinksFromPage(pageId);

    // Extract links from the page content
    const links = extractLinksFromNodes(content);
    console.log(`🔄 [BACKLINKS] Extracted ${links.length} total links from content`);

    const pageLinks = links.filter(link => link.type === 'page' && link.pageId);
    console.log(`🔄 [BACKLINKS] Found ${pageLinks.length} page links:`, pageLinks.map(link => ({
      pageId: link.pageId,
      text: link.text,
      url: link.url
    })));

    if (pageLinks.length === 0) {
      console.log(`📝 [BACKLINKS] No page links found in ${pageId}, backlinks index updated`);
      return;
    }

    // Create batch for efficient writes
    let batch;
    if (isServerSide) {
      // Use Admin SDK batch
      batch = database.batch();
    } else {
      // Use client SDK batch
      batch = writeBatch(db);
    }
    
    // Add new backlink entries and create notifications
    for (const link of pageLinks) {
      const backlinkId = `${pageId}_to_${link.pageId}`;

      let backlinkRef;
      let backlinkEntry;

      if (isServerSide) {
        // Use Admin SDK
        backlinkRef = database.collection(getCollectionName("backlinks")).doc(backlinkId);
        backlinkEntry = {
          id: backlinkId,
          sourcePageId: pageId,
          sourcePageTitle: pageTitle,
          sourceUsername: username,
          targetPageId: link.pageId,
          linkText: link.text || '',
          linkUrl: link.url || '',
          createdAt: new Date(), // Admin SDK uses Date objects
          lastModified: lastModified,
          isPublic: isPublic
        };
      } else {
        // Use client SDK
        backlinkRef = doc(db, getCollectionName("backlinks"), backlinkId);
        backlinkEntry = {
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
      }

      batch.set(backlinkRef, backlinkEntry);
    }

    // Commit the batch
    console.log(`🔄 [BACKLINKS] Committing batch with ${pageLinks.length} backlink entries using ${isServerSide ? 'Admin SDK' : 'Client SDK'}...`);
    await batch.commit();

    console.log(`✅ [BACKLINKS] Successfully updated backlinks index: ${pageLinks.length} links from page ${pageId}`);

    // Create notifications for page mentions (links)
    if (!isServerSide) {
      // Only create notifications on client side to avoid duplicate notifications
      await createLinkNotifications(pageId, pageTitle, username, pageLinks);
    } else {
      // Server-side: Send email notifications for page links
      await sendPageLinkedEmails(pageId, pageTitle, username, pageLinks, database);
    }
    
  } catch (error) {
    console.error('Error updating backlinks index:', error);
    throw error;
  }
}

/**
 * Create notifications for page mentions (when pages link to other pages)
 */
async function createLinkNotifications(
  sourcePageId: string,
  sourcePageTitle: string,
  sourceUsername: string,
  pageLinks: any[]
): Promise<void> {
  try {
    console.log(`🔔 [NOTIFICATIONS] Creating link notifications for ${pageLinks.length} page links`);

    // Import notification service
    const { createNotification } = await import('../../services/notificationsApi');

    // Get target page data to find the page owners
    for (const link of pageLinks) {
      try {
        // Get the target page to find its owner
        const targetPageDoc = await getDoc(doc(db, getCollectionName('pages'), link.pageId));

        if (targetPageDoc.exists()) {
          const targetPageData = targetPageDoc.data();
          const targetUserId = targetPageData.userId;

          // Don't notify if the user is linking to their own page
          if (targetUserId && targetUserId !== sourceUsername) {
            await createNotification({
              userId: targetUserId,
              type: 'link',
              title: 'Page Mention',
              message: `${sourceUsername} linked to your page "${targetPageData.title || 'Untitled'}"`,
              sourceUserId: sourceUsername, // This should be the user ID, but we have username
              targetPageId: link.pageId,
              targetPageTitle: targetPageData.title || 'Untitled',
              metadata: {
                sourcePageId,
                sourcePageTitle,
                linkText: link.text || '',
                category: 'engagement'
              }
            });

            console.log(`🔔 [NOTIFICATIONS] Created link notification for user ${targetUserId}`);
          }
        }
      } catch (notificationError) {
        console.error(`❌ [NOTIFICATIONS] Error creating notification for link to ${link.pageId}:`, notificationError);
        // Continue with other notifications even if one fails
      }
    }
  } catch (error) {
    console.error(`❌ [NOTIFICATIONS] Error creating link notifications:`, error);
    // Don't throw - notifications are not critical for backlinks functionality
  }
}

/**
 * Send email notifications for page links (server-side only)
 */
async function sendPageLinkedEmails(
  sourcePageId: string,
  sourcePageTitle: string,
  sourceUsername: string,
  pageLinks: any[],
  database: any
): Promise<void> {
  try {
    console.log(`📧 [EMAIL] Sending page-linked emails for ${pageLinks.length} links`);

    // Import email service
    const { sendPageLinkedEmail } = await import('../../services/emailService');

    for (const link of pageLinks) {
      try {
        // Get the target page to find its owner
        const targetPageDoc = await database.collection(getCollectionName('pages')).doc(link.pageId).get();

        if (targetPageDoc.exists) {
          const targetPageData = targetPageDoc.data();
          const targetUserId = targetPageData.userId;

          // Don't notify if the user is linking to their own page
          // Need to look up the source user ID from username
          const sourceUserQuery = await database.collection(getCollectionName('users'))
            .where('username', '==', sourceUsername)
            .limit(1)
            .get();
          
          const sourceUserId = sourceUserQuery.empty ? null : sourceUserQuery.docs[0].id;

          if (targetUserId && targetUserId !== sourceUserId) {
            // Get the target user's email and preferences
            const targetUserDoc = await database.collection(getCollectionName('users')).doc(targetUserId).get();

            if (targetUserDoc.exists) {
              const targetUserData = targetUserDoc.data();

              // Check if user wants engagement emails
              if (targetUserData.emailPreferences?.engagement !== false && targetUserData.email) {
                await sendPageLinkedEmail({
                  to: targetUserData.email,
                  username: targetUserData.username || 'there',
                  linkedPageTitle: targetPageData.title || 'Untitled',
                  linkerUsername: sourceUsername,
                  linkerPageTitle: sourcePageTitle,
                  userId: targetUserId
                });

                console.log(`📧 [EMAIL] Sent page-linked email to user ${targetUserId}`);
              }
            }
          }
        }
      } catch (emailError) {
        console.error(`❌ [EMAIL] Error sending page-linked email for link to ${link.pageId}:`, emailError);
        // Continue with other emails even if one fails
      }
    }
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending page-linked emails:`, error);
    // Don't throw - emails are not critical for backlinks functionality
  }
}

/**
 * Remove all backlinks from a specific source page
 */
export async function removeBacklinksFromPage(sourcePageId: string): Promise<void> {
  try {
    const database = getDatabase();
    const isServerSide = typeof window === 'undefined';

    let snapshot;
    if (isServerSide) {
      // Use Admin SDK
      const backlinksQuery = database.collection(getCollectionName('backlinks'))
        .where('sourcePageId', '==', sourcePageId);
      snapshot = await backlinksQuery.get();
    } else {
      // Use client SDK
      const backlinksQuery = query(
        collection(db, getCollectionName('backlinks')),
        where('sourcePageId', '==', sourcePageId)
      );
      snapshot = await getDocs(backlinksQuery);
    }

    if (snapshot.empty) {
      return;
    }

    // Create batch for efficient deletes
    let batch;
    if (isServerSide) {
      batch = database.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    } else {
      batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    await batch.commit();

    console.log(`🗑️ Removed ${snapshot.docs.length} backlinks from page ${sourcePageId} using ${isServerSide ? 'Admin SDK' : 'Client SDK'}`);

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
      collection(db, getCollectionName('backlinks')),
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
      collection(db, getCollectionName('backlinks')),
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

