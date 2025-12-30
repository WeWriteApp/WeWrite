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

// NOTE: This file is imported by client-side code, so we cannot use firebase-admin here.
// All operations use the client SDK. Server-side backlink operations should use API routes.

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

    return backlinks;
    
  } catch (error) {
    // If the error is due to index building, provide a fallback
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
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
    // First, remove all existing backlinks from this page
    await removeBacklinksFromPage(pageId);

    // Extract links from the page content
    const links = extractLinksFromNodes(content);

    const pageLinks = links.filter(link => link.type === 'page' && link.pageId);

    if (pageLinks.length === 0) {
      return;
    }

    // Create batch for efficient writes using client SDK
    const batch = writeBatch(db);
    
    // Add new backlink entries and create notifications
    for (const link of pageLinks) {
      const backlinkId = `${pageId}_to_${link.pageId}`;
      const backlinkRef = doc(db, getCollectionName("backlinks"), backlinkId);
      const backlinkEntry = {
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

    // Create notifications for page mentions (links)
    await createLinkNotifications(pageId, pageTitle, username, pageLinks);

  } catch (error) {
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
    // Import notification service (this is safe for client-side)
    const { createNotification } = await import('../../services/notificationsService');

    // Get the source page to find its owner and look up the actual username
    let actualSourceUsername = sourceUsername;
    let sourceUserId: string | null = null;

    try {
      const sourcePageDoc = await getDoc(doc(db, getCollectionName('pages'), sourcePageId));
      if (sourcePageDoc.exists()) {
        const sourcePageData = sourcePageDoc.data();
        sourceUserId = sourcePageData.userId;

        // Look up the actual username from the users collection
        if (sourceUserId) {
          const sourceUserDoc = await getDoc(doc(db, getCollectionName('users'), sourceUserId));
          if (sourceUserDoc.exists()) {
            const sourceUserData = sourceUserDoc.data();
            actualSourceUsername = sourceUserData.username || sourceUsername;
          }
        }
      }
    } catch (sourceUserError) {
      // If lookup fails, continue with the original sourceUsername
    }

    // Get target page data to find the page owners
    for (const link of pageLinks) {
      try {
        // Get the target page to find its owner
        const targetPageDoc = await getDoc(doc(db, getCollectionName('pages'), link.pageId));

        if (targetPageDoc.exists()) {
          const targetPageData = targetPageDoc.data();
          const targetUserId = targetPageData.userId;

          // Don't notify if the user is linking to their own page
          if (targetUserId && targetUserId !== sourceUserId) {
            // Create in-app notification
            await createNotification({
              userId: targetUserId,
              type: 'link',
              title: 'Page Mention',
              message: `${actualSourceUsername} linked to your page "${targetPageData.title || 'Untitled'}"`,
              sourceUserId: sourceUserId || actualSourceUsername,
              targetPageId: link.pageId,
              targetPageTitle: targetPageData.title || 'Untitled',
              metadata: {
                sourcePageId,
                sourcePageTitle,
                linkText: link.text || '',
                category: 'engagement'
              }
            });

            // Send email notification via API (fire-and-forget)
            // We use an API call here because emailService uses firebase-admin which can't run client-side
            try {
              // Get target user's email and preferences
              const targetUserDoc = await getDoc(doc(db, getCollectionName('users'), targetUserId));
              if (targetUserDoc.exists()) {
                const targetUserData = targetUserDoc.data();
                const targetEmail = targetUserData.email;
                const targetUsername = targetUserData.username || `user_${targetUserId.slice(0, 8)}`;

                // Check if user wants email notifications for page links
                const shouldSendEmail = targetUserData.emailPreferences?.engagement !== false;

                if (targetEmail && shouldSendEmail) {
                  // Call the email API endpoint instead of directly importing emailService
                  fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      templateId: 'page-linked',
                      to: targetEmail,
                      data: {
                        username: targetUsername,
                        linkedPageTitle: targetPageData.title || 'Untitled',
                        linkerUsername: actualSourceUsername,
                        linkerPageTitle: sourcePageTitle,
                        linkerPageId: sourcePageId
                      },
                      userId: targetUserId
                    })
                  }).catch(() => {
                    // Email send failed, but don't log
                  });
                }
              }
            } catch (emailError) {
              // Don't fail notifications if email fails
            }
          }
        }
      } catch (notificationError) {
        // Continue with other notifications even if one fails
      }
    }
  } catch (error) {
    // Don't throw - notifications are not critical for backlinks functionality
  }
}

/**
 * Remove all backlinks from a specific source page
 */
export async function removeBacklinksFromPage(sourcePageId: string): Promise<void> {
  try {
    // Use client SDK
    const backlinksQuery = query(
      collection(db, getCollectionName('backlinks')),
      where('sourcePageId', '==', sourcePageId)
    );
    const snapshot = await getDocs(backlinksQuery);

    if (snapshot.empty) {
      return;
    }

    // Create batch for efficient deletes
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();

  } catch (error) {
    throw error;
  }
}

/**
 * Remove a specific page from the backlinks index (when page is deleted)
 */
export async function removePageFromBacklinksIndex(pageId: string): Promise<void> {
  try {
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
    }

  } catch (error) {
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
    return 0;
  }
}

