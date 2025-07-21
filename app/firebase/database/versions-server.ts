/**
 * Server-side version operations using Firebase Admin SDK
 * This file handles version operations from API routes with proper server-side authentication
 */

import { getFirebaseAdmin } from '../firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import logger from '../../utils/logger';
import { hasContentChangedSync } from "../../utils/diffService";

export interface VersionData {
  content: any;
  userId: string;
  username: string;
  groupId?: string;
}

/**
 * Server-side version save using Firebase Admin SDK
 * This bypasses Firebase security rules since it runs with admin privileges
 */
export const saveNewVersionServer = async (pageId: string, data: VersionData) => {
  try {
    console.log('🔵 VERSION SERVER: Starting version save', {
      pageId,
      userId: data.userId,
      username: data.username,
      hasContent: !!data.content,
      environment: process.env.NODE_ENV
    });

    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    // Convert content to string for storage and comparison
    const contentString = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    
    if (!contentString || contentString.trim() === '') {
      console.error("🔴 VERSION SERVER: Content is empty or invalid");
      return {
        success: false,
        error: "Content cannot be empty"
      };
    }

    // Get the current page to find the current version
    const pageRef = db.collection(getCollectionName("pages")).doc(pageId);
    const pageDoc = await pageRef.get();
    
    if (!pageDoc.exists) {
      console.error("🔴 VERSION SERVER: Page not found:", pageId);
      return {
        success: false,
        error: "Page not found"
      };
    }

    const pageData = pageDoc.data();
    const currentVersionId = pageData?.currentVersion;
    const isNewPage = !currentVersionId;

    // Enhanced no-op detection: Check if content has changed
    let isNoOpEdit = false;
    if (!isNewPage && pageData?.content) {
      const currentContent = typeof pageData.content === 'string' ? pageData.content : JSON.stringify(pageData.content);
      isNoOpEdit = !hasContentChangedSync(contentString, currentContent);
      
      if (isNoOpEdit) {
        console.log("🔵 VERSION SERVER: No-op edit detected, skipping version creation");
        return {
          success: true,
          versionId: currentVersionId,
          isNoOp: true
        };
      }
    }

    // Create timestamp
    const now = admin.firestore.Timestamp.now();

    // Prepare version data
    const versionData = {
      content: contentString,
      createdAt: now,
      userId: data.userId,
      username: data.username,
      previousVersionId: currentVersionId || null,
      groupId: data.groupId || null
    };

    console.log('🔵 VERSION SERVER: Creating new version document', {
      pageId,
      collectionPath: `${getCollectionName("pages")}/${pageId}/versions`,
      versionDataKeys: Object.keys(versionData)
    });

    // Create the new version document
    const versionsRef = pageRef.collection("versions");
    const versionRef = await versionsRef.add(versionData);
    
    console.log("✅ VERSION SERVER: Created new version with ID:", versionRef.id);

    // Calculate diff data BEFORE updating the page
    let diffResult = null;
    try {
      const { calculateDiff } = await import('../../utils/diffService');
      const currentPageContent = pageData?.content || '';
      const currentContentString = typeof currentPageContent === 'string' ? currentPageContent : JSON.stringify(currentPageContent);
      
      diffResult = await calculateDiff(contentString, currentContentString);
      console.log("✅ VERSION SERVER: Diff calculated:", {
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: diffResult.added > 0 || diffResult.removed > 0
      });
    } catch (diffError) {
      console.error("🔴 VERSION SERVER: Error calculating diff (non-fatal):", diffError);
    }

    // Update the page document with the new current version and content
    const pageUpdateData = {
      currentVersion: versionRef.id,
      content: contentString,
      lastModified: now,
      // Store diff information for recent activity display
      lastDiff: diffResult ? {
        added: diffResult.added || 0,
        removed: diffResult.removed || 0,
        hasChanges: (diffResult.added > 0 || diffResult.removed > 0) || isNewPage,
        preview: diffResult.preview || null
      } : null
    };

    console.log('🔵 VERSION SERVER: Updating page document', {
      pageId,
      currentVersion: versionRef.id,
      contentLength: contentString.length,
      hasDiff: !!diffResult
    });

    await pageRef.update(pageUpdateData);
    console.log("✅ VERSION SERVER: Page document updated successfully");

    // Record user activity for streak tracking (server-side)
    try {
      const { recordUserActivity } = await import('../streaks');
      await recordUserActivity(data.userId, 'page_edit', {
        pageId,
        versionId: versionRef.id,
        contentLength: contentString.length,
        isNewPage
      });
      console.log("✅ VERSION SERVER: User activity recorded");
    } catch (activityError) {
      console.error("🔴 VERSION SERVER: Error recording user activity (non-fatal):", activityError);
    }

    logger.info('Version saved successfully (server-side)', {
      pageId,
      versionId: versionRef.id,
      userId: data.userId,
      username: data.username,
      contentLength: contentString.length,
      isNewPage
    }, 'VERSION_SAVE');

    return {
      success: true,
      versionId: versionRef.id,
      isNoOp: false
    };

  } catch (error) {
    console.error("🔴 VERSION SERVER: Error saving new version:", {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      },
      context: {
        pageId,
        userId: data.userId,
        username: data.username,
        hasContent: !!data.content,
        environment: process.env.NODE_ENV,
        collectionName: getCollectionName("pages")
      }
    });
    
    logger.critical("Version save failed (server-side)", {
      error: error.message,
      stack: error.stack,
      pageId,
      userId: data.userId
    }, 'VERSION_SAVE');

    return {
      success: false,
      error: error.message
    };
  }
};
