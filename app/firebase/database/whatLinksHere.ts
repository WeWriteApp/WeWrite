/**
 * What Links Here System
 *
 * This system precomputes and indexes incoming page links for fast retrieval.
 * Instead of scanning through all pages on every request, we maintain
 * an index that gets updated when pages are saved.
 *
 * Note: The Firestore collection is still named "backlinks" for backward compatibility.
 * The code terminology uses "whatLinksHere" to match the UI naming.
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
// All operations use the client SDK. Server-side operations should use API routes.

/**
 * Entry in the what-links-here index (stored in 'backlinks' collection)
 */
export interface WhatLinksHereEntry {
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

/**
 * Summary of a page that links to the target page
 */
export interface WhatLinksHereSummary {
  id: string;
  title: string;
  username: string;
  lastModified: any;
  isPublic: boolean;
  linkText?: string;
}

// Backward-compatible type aliases
export type BacklinkEntry = WhatLinksHereEntry;
export type BacklinkSummary = WhatLinksHereSummary;

/**
 * Get all pages that link to a specific page (fast index-based lookup)
 */
export async function getWhatLinksHere(
  targetPageId: string,
  limit?: number
): Promise<WhatLinksHereSummary[]> {
  try {
    // Query the backlinks collection (name kept for backward compatibility)
    let whatLinksHereQuery = query(
      collection(db, getCollectionName('backlinks')),
      where('targetPageId', '==', targetPageId),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc')
    );

    if (limit) {
      whatLinksHereQuery = query(whatLinksHereQuery, firestoreLimit(limit));
    }

    const snapshot = await getDocs(whatLinksHereQuery);

    const results: WhatLinksHereSummary[] = snapshot.docs.map(doc => {
      const data = doc.data() as WhatLinksHereEntry;
      return {
        id: data.sourcePageId,
        title: data.sourcePageTitle,
        username: data.sourceUsername,
        lastModified: data.lastModified,
        isPublic: data.isPublic,
        linkText: data.linkText
      };
    });

    return results;

  } catch (error: any) {
    // If the error is due to index building, provide a fallback
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      try {
        // Fallback: Use the old findBacklinks method from links.ts
        const { findBacklinks } = await import('./links');
        const fallbackResults = await findBacklinks(targetPageId, limit || 20);

        // Convert to WhatLinksHereSummary format
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

// Backward-compatible alias
export const getBacklinks = getWhatLinksHere;

/**
 * Update the what-links-here index when a page is saved
 */
export async function updateWhatLinksHereIndex(
  pageId: string,
  pageTitle: string,
  username: string,
  content: any[],
  isPublic: boolean,
  lastModified: any
): Promise<void> {
  try {
    // First, remove all existing entries from this page
    await removePageLinksFromIndex(pageId);

    // Extract links from the page content
    const links = extractLinksFromNodes(content);

    const pageLinks = links.filter(link => link.type === 'page' && link.pageId);

    if (pageLinks.length === 0) {
      return;
    }

    // Create batch for efficient writes using client SDK
    const batch = writeBatch(db);

    // Add new entries
    for (const link of pageLinks) {
      const entryId = `${pageId}_to_${link.pageId}`;
      const entryRef = doc(db, getCollectionName("backlinks"), entryId);
      const entry = {
        id: entryId,
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

      batch.set(entryRef, entry);
    }

    // Commit the batch
    await batch.commit();

    // Create notifications for page mentions (links)
    await createLinkNotifications(pageId, pageTitle, username, pageLinks);

  } catch (error) {
    throw error;
  }
}

// Backward-compatible alias
export const updateBacklinksIndex = updateWhatLinksHereIndex;

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
    // Don't throw - notifications are not critical for what-links-here functionality
  }
}

/**
 * Remove all outgoing links from a specific page from the index
 */
export async function removePageLinksFromIndex(sourcePageId: string): Promise<void> {
  try {
    // Use client SDK
    const linksQuery = query(
      collection(db, getCollectionName('backlinks')),
      where('sourcePageId', '==', sourcePageId)
    );
    const snapshot = await getDocs(linksQuery);

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

// Backward-compatible alias
export const removeBacklinksFromPage = removePageLinksFromIndex;

/**
 * Remove a page completely from the what-links-here index (when page is deleted)
 */
export async function removePageFromWhatLinksHereIndex(pageId: string): Promise<void> {
  try {
    // Remove outgoing links FROM this page
    await removePageLinksFromIndex(pageId);

    // Remove incoming links TO this page
    const incomingLinksQuery = query(
      collection(db, getCollectionName('backlinks')),
      where('targetPageId', '==', pageId)
    );

    const snapshot = await getDocs(incomingLinksQuery);

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

// Backward-compatible alias
export const removePageFromBacklinksIndex = removePageFromWhatLinksHereIndex;

/**
 * Get count of pages that link to a specific page (fast)
 */
export async function getWhatLinksHereCount(targetPageId: string): Promise<number> {
  try {
    const linksQuery = query(
      collection(db, getCollectionName('backlinks')),
      where('targetPageId', '==', targetPageId),
      where('isPublic', '==', true)
    );

    const snapshot = await getDocs(linksQuery);
    return snapshot.size;

  } catch (error) {
    return 0;
  }
}

// Backward-compatible alias
export const getBacklinksCount = getWhatLinksHereCount;
