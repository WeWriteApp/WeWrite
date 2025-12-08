/**
 * Link Mention Service
 *
 * Handles notifications and emails when users link to pages or mention users
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';
import { sendPageLinkedEmail } from './emailService';

interface LinkMentionData {
  sourceUserId: string;
  sourceUsername: string;
  sourcePageId: string;
  sourcePageTitle: string;
  targetUserId: string;
  targetUsername?: string;
  targetPageId?: string;
  targetPageTitle?: string;
  isUserMention: boolean; // true if linking to user page, false if linking to content page
}

/**
 * Create a notification when someone links to a page or mentions a user
 */
export async function createLinkMentionNotification(data: LinkMentionData): Promise<boolean> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Don't create notification if user is linking to their own content
    if (data.sourceUserId === data.targetUserId) {
      console.log('[LinkMention] Skipping notification - user linking to own content');
      return true;
    }

    // Check if target user has notification preferences that opt out
    const targetUserDoc = await db.collection(getCollectionName('users')).doc(data.targetUserId).get();
    if (!targetUserDoc.exists) {
      console.warn('[LinkMention] Target user not found:', data.targetUserId);
      return false;
    }

    const targetUserData = targetUserDoc.data();
    const emailPrefs = targetUserData?.emailPreferences || {};
    const notificationPrefs = targetUserData?.notificationPreferences || {};

    // Check if user has opted out of link/mention notifications
    if (data.isUserMention) {
      if (notificationPrefs.userMentions === false) {
        console.log('[LinkMention] User has opted out of mention notifications');
        return true;
      }
    } else {
      if (notificationPrefs.pageLinks === false) {
        console.log('[LinkMention] User has opted out of page link notifications');
        return true;
      }
    }

    // Create notification
    const notificationType = data.isUserMention ? 'user_mention' : 'link';
    const notificationTitle = data.isUserMention
      ? `@${data.sourceUsername} mentioned you`
      : `@${data.sourceUsername} linked to your page`;
    const notificationMessage = data.isUserMention
      ? `@${data.sourceUsername} mentioned you in "${data.sourcePageTitle}"`
      : `@${data.sourceUsername} linked to "${data.targetPageTitle}" in their page "${data.sourcePageTitle}"`;
    const actionUrl = data.isUserMention
      ? `/${data.sourcePageId}` // Go to the page where they were mentioned
      : `/${data.targetPageId}`; // Go to the page that was linked

    const notificationsRef = db.collection(getCollectionName('users'))
      .doc(data.targetUserId)
      .collection(getCollectionName('notifications'));
    const notificationRef = notificationsRef.doc();

    const batch = db.batch();

    const notification = {
      userId: data.targetUserId,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      sourceUserId: data.sourceUserId,
      sourceUsername: data.sourceUsername,
      sourcePageId: data.sourcePageId,
      sourcePageTitle: data.sourcePageTitle,
      targetPageId: data.targetPageId,
      targetPageTitle: data.targetPageTitle,
      actionUrl,
      metadata: {
        isUserMention: data.isUserMention,
        linkedFrom: data.sourcePageId,
        linkedTo: data.isUserMention ? `/user/${data.targetUserId}` : `/${data.targetPageId}`
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.set(notificationRef, notification);

    // Increment unread count
    const userDocRef = db.collection(getCollectionName('users')).doc(data.targetUserId);
    batch.update(userDocRef, {
      unreadNotificationsCount: admin.firestore.FieldValue.increment(1)
    });

    await batch.commit();

    console.log(`[LinkMention] Created ${notificationType} notification for user ${data.targetUserId}`);

    // Send email notification if user hasn't opted out
    const shouldSendEmail = data.isUserMention
      ? emailPrefs.userMentions !== false
      : emailPrefs.pageLinks !== false;

    if (shouldSendEmail && targetUserData?.email) {
      try {
        await sendPageLinkedEmail({
          to: targetUserData.email,
          username: data.targetUsername || targetUserData.username || 'there',
          linkedPageTitle: data.targetPageTitle || 'your profile',
          linkerUsername: data.sourceUsername,
          linkerPageTitle: data.sourcePageTitle,
          userId: data.targetUserId
        });
        console.log(`[LinkMention] Sent email notification to ${targetUserData.email}`);
      } catch (emailError) {
        console.error('[LinkMention] Failed to send email:', emailError);
        // Don't fail the notification if email fails
      }
    }

    return true;
  } catch (error) {
    console.error('[LinkMention] Error creating notification:', error);
    return false;
  }
}

/**
 * Extract link mentions from page content and create notifications
 * Call this when a page is saved/updated
 */
export async function processPageLinksForNotifications(
  pageId: string,
  pageTitle: string,
  authorId: string,
  authorUsername: string,
  content: any
): Promise<void> {
  try {
    if (!content || !Array.isArray(content)) {
      return;
    }

    const linkedUserIds = new Set<string>();
    const linkedPageIds = new Set<string>();

    // Extract all links from the content
    const extractLinks = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'link') {
          // Check if it's a user link
          if (node.url && node.url.startsWith('/user/')) {
            const userId = node.url.replace('/user/', '').split('?')[0];
            if (userId && userId !== authorId) {
              linkedUserIds.add(userId);
            }
          }
          // Check if it's a page link
          else if (node.pageId && node.pageId !== pageId) {
            linkedPageIds.add(node.pageId);
          }
        }

        // Recursively check children
        if (node.children && Array.isArray(node.children)) {
          extractLinks(node.children);
        }
      }
    };

    extractLinks(content);

    // Create notifications for user mentions
    for (const userId of linkedUserIds) {
      await createLinkMentionNotification({
        sourceUserId: authorId,
        sourceUsername: authorUsername,
        sourcePageId: pageId,
        sourcePageTitle: pageTitle,
        targetUserId: userId,
        isUserMention: true
      });
    }

    // Create notifications for page links
    const admin = getFirebaseAdmin();
    if (!admin) return;
    const db = admin.firestore();

    for (const linkedPageId of linkedPageIds) {
      // Get the page owner
      const pageDoc = await db.collection(getCollectionName('pages')).doc(linkedPageId).get();
      if (!pageDoc.exists) continue;

      const pageData = pageDoc.data();
      if (!pageData) continue;

      const pageOwnerId = pageData.userId;
      const pageOwnerUsername = pageData.username;
      const linkedPageTitle = pageData.title;

      if (pageOwnerId && pageOwnerId !== authorId) {
        await createLinkMentionNotification({
          sourceUserId: authorId,
          sourceUsername: authorUsername,
          sourcePageId: pageId,
          sourcePageTitle: pageTitle,
          targetUserId: pageOwnerId,
          targetUsername: pageOwnerUsername,
          targetPageId: linkedPageId,
          targetPageTitle: linkedPageTitle,
          isUserMention: false
        });
      }
    }

    console.log(`[LinkMention] Processed ${linkedUserIds.size} user mentions and ${linkedPageIds.size} page links`);
  } catch (error) {
    console.error('[LinkMention] Error processing page links:', error);
    // Don't throw - notifications are non-critical
  }
}
