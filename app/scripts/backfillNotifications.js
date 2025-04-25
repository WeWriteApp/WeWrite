"use client";

import { db } from '../firebase/database';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  increment,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { createFollowNotification, createLinkNotification } from '../firebase/notifications';

/**
 * Backfill notifications for past follows and page links
 */
export async function backfillNotifications() {
  try {
    console.log('Starting notification backfill...');
    
    // Track statistics
    const stats = {
      followNotificationsCreated: 0,
      linkNotificationsCreated: 0,
      usersProcessed: 0,
      pagesProcessed: 0,
      errors: 0
    };
    
    // Step 1: Backfill follow notifications
    await backfillFollowNotifications(stats);
    
    // Step 2: Backfill link notifications
    await backfillLinkNotifications(stats);
    
    console.log('Notification backfill complete!');
    console.log('Statistics:', stats);
    
    return { success: true, stats };
  } catch (error) {
    console.error('Error backfilling notifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Backfill notifications for page follows
 */
async function backfillFollowNotifications(stats) {
  try {
    console.log('Backfilling follow notifications...');
    
    // Get all page follower records
    const pageFollowersRef = collection(db, 'pageFollowers');
    const pageFollowersSnapshot = await getDocs(pageFollowersRef);
    
    console.log(`Processing ${pageFollowersSnapshot.size} page follower records...`);
    
    // Process each follow record
    for (const followDoc of pageFollowersSnapshot.docs) {
      try {
        const followData = followDoc.data();
        
        // Skip if this is a deleted follow
        if (followData.deleted) continue;
        
        const pageId = followData.pageId;
        const followerId = followData.userId;
        
        if (!pageId || !followerId) continue;
        
        // Get the page details
        const pageRef = doc(db, 'pages', pageId);
        const pageDoc = await getDoc(pageRef);
        
        if (!pageDoc.exists()) continue;
        
        const pageData = pageDoc.data();
        const pageOwnerId = pageData.userId;
        const pageTitle = pageData.title || 'Untitled Page';
        
        // Skip if the follower is the page owner (self-follow)
        if (followerId === pageOwnerId) continue;
        
        // Check if a notification already exists
        const notificationsRef = collection(db, 'users', pageOwnerId, 'notifications');
        const notificationsQuery = query(
          notificationsRef,
          where('type', '==', 'follow'),
          where('sourceUserId', '==', followerId),
          where('targetPageId', '==', pageId)
        );
        
        const existingNotifications = await getDocs(notificationsQuery);
        
        // Skip if notification already exists
        if (!existingNotifications.empty) continue;
        
        // Create the notification
        const notificationRef = doc(notificationsRef);
        await setDoc(notificationRef, {
          type: 'follow',
          sourceUserId: followerId,
          targetPageId: pageId,
          targetPageTitle: pageTitle,
          read: true, // Mark as read since it's a backfilled notification
          createdAt: followData.followedAt || serverTimestamp()
        });
        
        stats.followNotificationsCreated++;
      } catch (error) {
        console.error('Error processing follow record:', error);
        stats.errors++;
      }
    }
    
    console.log(`Created ${stats.followNotificationsCreated} follow notifications`);
    return stats;
  } catch (error) {
    console.error('Error backfilling follow notifications:', error);
    stats.errors++;
    return stats;
  }
}

/**
 * Backfill notifications for page links
 */
async function backfillLinkNotifications(stats) {
  try {
    console.log('Backfilling link notifications...');
    
    // Get all pages
    const pagesRef = collection(db, 'pages');
    const pagesSnapshot = await getDocs(pagesRef);
    
    console.log(`Processing ${pagesSnapshot.size} pages for links...`);
    
    // Process each page
    for (const pageDoc of pagesSnapshot.docs) {
      try {
        const pageId = pageDoc.id;
        const pageData = pageDoc.data();
        const sourceUserId = pageData.userId;
        const sourcePageTitle = pageData.title || 'Untitled Page';
        
        if (!sourceUserId) continue;
        
        // Skip if the page doesn't have content
        if (!pageData.content) continue;
        
        // Parse the content to extract links
        let parsedContent;
        try {
          parsedContent = JSON.parse(pageData.content);
        } catch (error) {
          console.error(`Error parsing content for page ${pageId}:`, error);
          continue;
        }
        
        // Extract links from the content
        const links = extractLinksFromNodes(parsedContent);
        
        // Process each link
        for (const link of links) {
          try {
            // Check if it's a page link (internal link to another page)
            if (link.url && (link.url.startsWith('/') || link.url.startsWith('/pages/'))) {
              // Extract the page ID from the URL
              const targetPageId = link.url.replace('/pages/', '/').replace('/', '');
              
              if (targetPageId && targetPageId !== pageId) { // Don't notify for self-links
                // Get the target page to check its owner
                const targetPageRef = doc(db, 'pages', targetPageId);
                const targetPageDoc = await getDoc(targetPageRef);
                
                if (targetPageDoc.exists()) {
                  const targetPageData = targetPageDoc.data();
                  const targetUserId = targetPageData.userId;
                  const targetPageTitle = targetPageData.title || 'Untitled Page';
                  
                  // Skip if the link is to a page owned by the same user
                  if (targetUserId && targetUserId !== sourceUserId) {
                    // Check if a notification already exists
                    const notificationsRef = collection(db, 'users', targetUserId, 'notifications');
                    const notificationsQuery = query(
                      notificationsRef,
                      where('type', '==', 'link'),
                      where('sourceUserId', '==', sourceUserId),
                      where('targetPageId', '==', targetPageId),
                      where('sourcePageId', '==', pageId)
                    );
                    
                    const existingNotifications = await getDocs(notificationsQuery);
                    
                    // Skip if notification already exists
                    if (!existingNotifications.empty) continue;
                    
                    // Create the notification
                    const notificationRef = doc(notificationsRef);
                    await setDoc(notificationRef, {
                      type: 'link',
                      sourceUserId,
                      targetPageId,
                      targetPageTitle,
                      sourcePageId: pageId,
                      sourcePageTitle,
                      read: true, // Mark as read since it's a backfilled notification
                      createdAt: pageData.lastModified ? new Date(pageData.lastModified) : serverTimestamp()
                    });
                    
                    stats.linkNotificationsCreated++;
                  }
                }
              }
            }
          } catch (linkError) {
            console.error('Error processing link:', linkError);
            stats.errors++;
          }
        }
        
        stats.pagesProcessed++;
        if (stats.pagesProcessed % 100 === 0) {
          console.log(`Processed ${stats.pagesProcessed} pages...`);
          console.log(`Created ${stats.linkNotificationsCreated} link notifications so far`);
        }
      } catch (pageError) {
        console.error(`Error processing page ${pageDoc.id}:`, pageError);
        stats.errors++;
      }
    }
    
    console.log(`Created ${stats.linkNotificationsCreated} link notifications`);
    return stats;
  } catch (error) {
    console.error('Error backfilling link notifications:', error);
    stats.errors++;
    return stats;
  }
}

/**
 * Extract links from content nodes
 */
function extractLinksFromNodes(nodes) {
  let links = [];

  function traverse(node) {
    // Check if the node is a link
    if (node.type === 'link' && node.url) {
      links.push({
        url: node.url,
        pageId: node.pageId,
        pageTitle: node.pageTitle
      });
    }

    // Recursively check children if they exist
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  // Start traversal
  if (Array.isArray(nodes)) {
    nodes.forEach(traverse);
  }

  return links;
}
