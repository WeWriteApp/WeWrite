import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit
} from "firebase/firestore";

import { db } from "./core";
import { extractLinksFromNodes } from "./links";
import { createLinkNotification, createAppendNotification } from "../notifications";
import { recordUserActivity } from "../streaks";

import type { PageVersion } from "../../types/database";

/**
 * Get all versions for a page
 */
export const getVersionsByPageId = async (pageId: string): Promise<PageVersion[] | Error> => {
  try {
    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    // add id of each version
    const versions = versionsSnap.docs.map((doc) => {
      return {
        id: doc.id,
        ...doc.data()
      } as PageVersion;
    });

    return versions;
  } catch (e) {
    return e as Error;
  }
};

/**
 * Get a specific version by ID
 */
export const getPageVersionById = async (pageId: string, versionId: string): Promise<PageVersion | null> => {
  try {
    if (!pageId || !versionId) {
      console.error("getPageVersionById called with invalid parameters:", { pageId, versionId });
      return null;
    }

    const pageRef = doc(db, "pages", pageId);
    const versionRef = doc(collection(pageRef, "versions"), versionId);
    const versionSnap = await getDoc(versionRef);

    if (!versionSnap.exists()) {
      console.error(`Version ${versionId} not found for page ${pageId}`);
      return null;
    }

    const versionData = versionSnap.data();

    // If this version has a previousVersionId, fetch the previous version as well
    let previousVersion = null;
    if (versionData.previousVersionId) {
      try {
        const prevVersionRef = doc(collection(pageRef, "versions"), versionData.previousVersionId);
        const prevVersionSnap = await getDoc(prevVersionRef);

        if (prevVersionSnap.exists()) {
          previousVersion = {
            id: prevVersionSnap.id,
            ...prevVersionSnap.data()
          };
        }
      } catch (prevError) {
        console.error("Error fetching previous version:", prevError);
        // Continue without previous version
      }
    }

    // Return version data with ID and previous version if available
    return {
      id: versionSnap.id,
      content: versionData.content || '',
      createdAt: versionData.createdAt || new Date().toISOString(),
      userId: versionData.userId || 'unknown',
      previousVersionId: versionData.previousVersionId,
      previousVersion,
      ...versionData
    } as PageVersion;
  } catch (error) {
    console.error("Error fetching page version:", error);
    return null;
  }
};

/**
 * Get recent versions for a page with proper sorting
 */
export const getPageVersions = async (pageId: string, versionCount: number = 10): Promise<any[]> => {
  try {
    if (!pageId) {
      console.error("getPageVersions called with invalid pageId:", pageId);
      return [];
    }

    const pageRef = doc(db, "pages", pageId);
    const versionsRef = collection(pageRef, "versions");

    // First try to get all versions without ordering (to avoid index requirements)
    try {
      const versionsSnap = await getDocs(versionsRef);

      if (versionsSnap.empty) {
        return [];
      }

      // Convert the docs to an array of data objects
      let versions = versionsSnap.docs.map((doc) => {
        try {
          const data = doc.data();

          // Handle different timestamp formats
          let createdAt = new Date();
          if (data.createdAt) {
            if (typeof data.createdAt === 'object' && data.createdAt.toDate) {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt.seconds && data.createdAt.nanoseconds) {
              // Firestore Timestamp format
              createdAt = new Date(data.createdAt.seconds * 1000);
            } else {
              // String or number format
              createdAt = new Date(data.createdAt);
            }
          }

          return {
            id: doc.id,
            ...data,
            createdAt,
            content: data.content || ""
          };
        } catch (err) {
          console.error(`Error processing version doc ${doc.id}:`, err);
          return null;
        }
      }).filter(version => version !== null);

      // Sort manually by createdAt in descending order
      versions.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date();
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date();
        return dateB.getTime() - dateA.getTime();
      });

      // Limit to the requested number
      versions = versions.slice(0, versionCount);

      return versions;
    } catch (innerError) {
      console.error("Error with simple version fetch, falling back:", innerError);

      // Fallback to the original query (which might still fail if index doesn't exist)
      try {
        const versionsQuery = query(
          versionsRef,
          orderBy("createdAt", "desc"),
          limit(versionCount)
        );

        const versionsSnap = await getDocs(versionsQuery);

        if (versionsSnap.empty) {
          return [];
        }

        // add id of each version and convert timestamp strings to Date objects
        const versions = versionsSnap.docs.map((doc) => {
          try {
            const data = doc.data();

            // Handle different timestamp formats
            let createdAt = new Date();
            if (data.createdAt) {
              if (typeof data.createdAt === 'object' && data.createdAt.toDate) {
                createdAt = data.createdAt.toDate();
              } else if (data.createdAt.seconds && data.createdAt.nanoseconds) {
                // Firestore Timestamp format
                createdAt = new Date(data.createdAt.seconds * 1000);
              } else {
                // String or number format
                createdAt = new Date(data.createdAt);
              }
            }

            return {
              id: doc.id,
              ...data,
              createdAt,
              content: data.content || ""
            };
          } catch (err) {
            console.error(`Error processing version doc ${doc.id}:`, err);
            return null;
          }
        }).filter(version => version !== null);

        return versions;
      } catch (queryError) {
        console.error("Error with fallback query:", queryError);
        return [];
      }
    }
  } catch (e) {
    console.error("Error fetching page versions:", e);
    return [];
  }
};

/**
 * Save a new version of a page
 */
export const saveNewVersion = async (pageId: string, data: any): Promise<any> => {
  try {
    console.log('saveNewVersion called with pageId:', pageId);

    // Validate content to prevent saving empty versions
    if (!data.content) {
      console.error("Cannot save empty content");
      return null;
    }

    // Ensure content is a string
    let contentString = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content);

    // Check for empty JSON structures
    if (contentString === '[]' || contentString === '{}' || contentString === '') {
      console.error("Cannot save empty content JSON");
      return null;
    }

    console.log('Content string to save:', contentString.substring(0, 100) + '...');

    // Parse content to validate it's proper JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(contentString);

      // Validate that content is not empty array
      if (Array.isArray(parsedContent) && parsedContent.length === 0) {
        console.error("Cannot save empty array content");
        return null;
      }

      // CRITICAL FIX: Check if content has meaningful data (text or links)
      // This fixes the bug where link-only content was being rejected
      if (Array.isArray(parsedContent)) {
        const hasContent = parsedContent.some(node => {
          // Check if node has text content
          if (node.children && Array.isArray(node.children)) {
            return node.children.some(child => {
              // Check for text content
              if (child.text && child.text.trim() !== '') {
                return true;
              }
              // Check for link content (links are valid content even without text)
              if (child.type === 'link' || child.url || child.pageId) {
                return true;
              }
              return false;
            });
          }
          // Check if the node itself is a link
          if (node.type === 'link' || node.url || node.pageId) {
            return true;
          }
          return false;
        });

        if (!hasContent) {
          console.error("Cannot save content with no meaningful data (no text or links)");
          return null;
        }
      }

      // Extract links from the content to check for page links
      const links = extractLinksFromNodes(parsedContent);

      // Process links to create notifications
      if (links.length > 0 && data.userId) {
        // Get the current page info for the notification
        const pageDoc = await getDoc(doc(db, "pages", pageId));
        const sourcePageTitle = pageDoc.exists() ? pageDoc.data().title || "Untitled Page" : "Untitled Page";

        // Process each link
        for (const link of links) {
          // Check if it's a page link (internal link to another page)
          if (link.url && (link.url.startsWith('/') || link.url.startsWith('/pages/'))) {
            // Extract the page ID from the URL
            const targetPageId = link.url.replace('/pages/', '/').replace('/', '');

            if (targetPageId && targetPageId !== pageId) { // Don't notify for self-links
              try {
                // Get the target page to check its owner
                const targetPageDoc = await getDoc(doc(db, "pages", targetPageId));

                if (targetPageDoc.exists()) {
                  const targetPageData = targetPageDoc.data();

                  // Only create notification if the target page owner is different from the link creator
                  if (targetPageData.userId && targetPageData.userId !== data.userId) {
                    await createLinkNotification(
                      targetPageData.userId, // Target user (owner of the linked page)
                      data.userId, // Source user (person creating the link)
                      pageId, // Source page ID
                      sourcePageTitle, // Source page title
                      targetPageId, // Target page ID
                      targetPageData.title || "Untitled Page" // Target page title
                    );
                  }
                }
              } catch (linkError) {
                console.error("Error processing link notification:", linkError);
                // Don't fail the save operation if notification creation fails
              }
            }
          }
        }
      }

    } catch (parseError) {
      console.error("Error parsing content JSON:", parseError);
      return null;
    }

    // Get the current page to find the current version
    const pageDoc = await getDoc(doc(db, "pages", pageId));
    if (!pageDoc.exists()) {
      console.error("Page not found:", pageId);
      return null;
    }

    const pageData = pageDoc.data();
    const currentVersionId = pageData.currentVersion;

    // Create the new version data
    const versionData = {
      content: contentString,
      createdAt: new Date().toISOString(),
      userId: data.userId,
      username: data.username || "Anonymous",
      groupId: data.groupId || null,
      previousVersionId: currentVersionId || null // Link to the previous version
    };

    // Create the new version document
    const versionRef = await addDoc(collection(db, "pages", pageId, "versions"), versionData);
    console.log("Created new version with ID:", versionRef.id);

    // Update the page document with the new current version and content
    await setDoc(doc(db, "pages", pageId), {
      currentVersion: versionRef.id,
      content: contentString, // Store content directly on page for faster access
      lastModified: new Date().toISOString()
    }, { merge: true });

    // Record user activity for streak tracking
    try {
      await recordUserActivity(data.userId);
      console.log("Recorded user activity for streak tracking");
    } catch (activityError) {
      console.error("Error recording user activity (non-fatal):", activityError);
      // Don't fail save operation if activity recording fails
    }

    console.log("Successfully saved new version and updated page");
    return versionRef.id;

  } catch (error) {
    console.error("Error saving new version:", error);
    return null;
  }
};
