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
      contentLength: typeof data.content === 'string' ? data.content.length : JSON.stringify(data.content).length,
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      timestamp: new Date().toISOString()
    });

    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    // Convert content to string for storage and comparison
    const contentString = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);

    // Keep the original content object for diff calculation
    const contentForDiff = data.content;
    
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
      // Use the original content objects for comparison, not JSON strings
      isNoOpEdit = !hasContentChangedSync(contentForDiff, pageData.content);

      if (isNoOpEdit) {
        console.log("🔵 VERSION SERVER: No-op edit detected, but still updating lastModified for recent edits tracking");

        // CRITICAL FIX: Even for no-op edits, update lastModified for recent edits tracking
        const now = new Date().toISOString();
        await pageRef.update({
          lastModified: now
        });
        console.log("✅ VERSION SERVER: Updated lastModified for no-op edit");

        return {
          success: true,
          versionId: currentVersionId,
          isNoOp: true
        };
      }
    }

    // Create timestamp - use ISO string for consistency with client-side
    const now = new Date().toISOString();

    // Calculate diff data BEFORE creating version
    let diffResult = null;
    try {
      const { calculateDiff } = await import('../../utils/diffService');
      const currentPageContent = pageData?.content || '';

      // Pass the actual content objects to calculateDiff, not JSON strings
      // The diff service will handle text extraction internally
      diffResult = await calculateDiff(contentForDiff, currentPageContent);
      console.log("✅ VERSION SERVER: Diff calculated:", {
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: diffResult.added > 0 || diffResult.removed > 0
      });
    } catch (diffError) {
      console.error("🔴 VERSION SERVER: Error calculating diff (non-fatal):", diffError);
    }

    // Prepare version data with diff information
    const versionData = {
      content: contentString,
      title: pageData?.title || 'Untitled',
      createdAt: now,
      userId: data.userId,
      username: data.username,
      previousVersionId: currentVersionId || null,
      groupId: data.groupId || null,

      // UNIFIED VERSION SYSTEM: Include diff data in version
      diff: diffResult ? {
        added: diffResult.added || 0,
        removed: diffResult.removed || 0,
        hasChanges: (diffResult.added > 0 || diffResult.removed > 0) || isNewPage
      } : {
        added: 0,
        removed: 0,
        hasChanges: isNewPage
      },

      // Rich diff preview for UI display
      diffPreview: diffResult?.preview || {
        beforeContext: '',
        addedText: isNewPage ? contentString.substring(0, 200) : '',
        removedText: '',
        afterContext: '',
        hasAdditions: isNewPage || (diffResult?.added > 0),
        hasRemovals: diffResult?.removed > 0
      },

      // Metadata
      isNewPage: isNewPage,
      isNoOp: false
    };

    console.log('🔵 VERSION SERVER: Creating new version document', {
      pageId,
      collectionPath: `${getCollectionName("pages")}/${pageId}/versions`,
      versionDataKeys: Object.keys(versionData)
    });

    // Create the new version document
    const versionsRef = pageRef.collection("versions");
    const versionRef = await versionsRef.add(versionData);
    
    console.log("✅ VERSION SERVER: Created new version with ID:", versionRef.id, "with diff data");

    // Update the page document with the new current version and content
    // CRITICAL FIX: Store content in original format (object), not as string
    const pageUpdateData = {
      currentVersion: versionRef.id,
      content: contentForDiff, // Use original content object, not string
      lastModified: now,
      // Store diff information for recent activity display
      lastDiff: diffResult ? {
        added: diffResult.added || 0,
        removed: diffResult.removed || 0,
        hasChanges: (diffResult.added > 0 || diffResult.removed > 0) || isNewPage,
        isNewPage: isNewPage,
        preview: diffResult.preview || null
      } : null
    };

    console.log('🔵 VERSION SERVER: Updating page document', {
      pageId,
      currentVersion: versionRef.id,
      contentType: typeof contentForDiff,
      contentLength: typeof contentForDiff === 'string' ? contentForDiff.length : JSON.stringify(contentForDiff).length,
      hasDiff: !!diffResult
    });

    await pageRef.update(pageUpdateData);
    console.log("✅ VERSION SERVER: Page document updated successfully");

    // PERFORMANCE: Run non-blocking operations in background (fire and forget)
    // User activity recording and cache invalidation don't need to block the response
    Promise.allSettled([
      // Record user activity for streak tracking
      (async () => {
        try {
          const { recordUserActivity } = await import('../streaks');
          await recordUserActivity(data.userId, 'page_edit', {
            pageId,
            versionId: versionRef.id,
            contentLength: contentString.length,
            isNewPage
          });
          console.log("✅ [BG] User activity recorded");
        } catch (err) {
          console.error("⚠️ [BG] User activity recording failed:", err);
        }
      })(),
      // Invalidate cache
      (async () => {
        try {
          const { invalidateCache } = await import('../../utils/serverCache');
          invalidateCache.page(pageId);
          if (data.userId) invalidateCache.user(data.userId);
          console.log('✅ [BG] Cache invalidated');
        } catch (err) {
          console.error('⚠️ [BG] Cache invalidation failed:', err);
        }
      })()
    ]).catch(err => console.error('⚠️ [BG] Background ops failed:', err));

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
