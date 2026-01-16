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
  /** When true, update existing version with same groupId instead of creating new one */
  batchWithGroup?: boolean;
  /** Explicit previous content for diff calculation. Pass null for new pages (no prior content). */
  previousContent?: any;
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

    // VERSION BATCHING: If batchWithGroup is true and we have a groupId,
    // try to update the existing version with the same groupId instead of creating a new one.
    // This prevents rapid auto-saves from creating dozens of versions during a typing session.
    // PERFORMANCE OPTIMIZATION: Diff calculation is done in background for batched saves.
    if (data.batchWithGroup && data.groupId && !isNewPage) {
      console.log("🔵 VERSION SERVER: Checking for existing version to batch with", {
        groupId: data.groupId,
        pageId
      });

      try {
        // Look for an existing version with the same groupId
        const existingVersionQuery = pageRef.collection("versions")
          .where("groupId", "==", data.groupId)
          .limit(1);

        const existingVersionSnapshot = await existingVersionQuery.get();

        if (!existingVersionSnapshot.empty) {
          const existingVersionDoc = existingVersionSnapshot.docs[0];
          const existingVersionId = existingVersionDoc.id;
          const existingVersionData = existingVersionDoc.data();

          console.log("🔵 VERSION SERVER: Found existing version to batch with", {
            existingVersionId,
            groupId: data.groupId
          });

          // PERFORMANCE: Save content immediately WITHOUT waiting for diff calculation
          const now = new Date().toISOString();
          const batchCount = (existingVersionData.batchCount || 1) + 1;

          // Update version with content immediately (keep existing diff data for now)
          const immediateUpdateData = {
            content: contentString,
            updatedAt: now,
            lastBatchedAt: now,
            batchCount
          };

          // Update page content immediately
          const immediatePageUpdate = {
            content: contentForDiff,
            lastModified: now
          };

          // Execute both updates in parallel for speed
          await Promise.all([
            existingVersionDoc.ref.update(immediateUpdateData),
            pageRef.update(immediatePageUpdate)
          ]);

          console.log("✅ VERSION SERVER: Batched into existing version (fast path)", {
            versionId: existingVersionId,
            batchCount
          });

          // BACKGROUND: Calculate diff and update version/page asynchronously
          // This doesn't block the save response
          const originalContent = existingVersionData.originalContent || existingVersionData.previousContent || pageData?.content;

          (async () => {
            try {
              const { calculateDiff } = await import('../../utils/diffService');
              const diffResult = await calculateDiff(contentForDiff, originalContent);

              if (diffResult) {
                const diffUpdateData = {
                  diff: {
                    added: diffResult.added || 0,
                    removed: diffResult.removed || 0,
                    hasChanges: (diffResult.added > 0 || diffResult.removed > 0)
                  },
                  diffPreview: diffResult.preview || null
                };

                // Update version and page with diff data in background
                await Promise.all([
                  existingVersionDoc.ref.update(diffUpdateData),
                  pageRef.update({
                    lastDiff: {
                      added: diffResult.added || 0,
                      removed: diffResult.removed || 0,
                      hasChanges: (diffResult.added > 0 || diffResult.removed > 0),
                      isNewPage: false,
                      preview: diffResult.preview || null
                    }
                  })
                ]);
                console.log("✅ [BG] Batch diff calculated and saved:", {
                  added: diffResult.added,
                  removed: diffResult.removed
                });
              }
            } catch (diffError) {
              console.error("⚠️ [BG] Batch diff calculation failed (non-fatal):", diffError);
            }
          })();

          return {
            success: true,
            versionId: existingVersionId,
            isNoOp: false,
            wasBatched: true,
            batchCount
          };
        } else {
          console.log("🔵 VERSION SERVER: No existing version with groupId found, creating new version", {
            groupId: data.groupId
          });
          // Fall through to create a new version with originalContent tracking
        }
      } catch (batchError) {
        console.error("🔴 VERSION SERVER: Error during version batching (non-fatal, will create new version):", batchError);
        // Fall through to create a new version
      }
    }

    // Create timestamp - use ISO string for consistency with client-side
    const now = new Date().toISOString();

    // Calculate diff data BEFORE creating version
    let diffResult = null;
    try {
      const { calculateDiff } = await import('../../utils/diffService');
      // Use explicit previousContent if provided (null means new page with no prior content)
      // Otherwise fall back to the current page content from Firestore
      const previousContent = data.previousContent !== undefined
        ? data.previousContent  // Explicit previous content (null for new pages)
        : (pageData?.content || '');

      // Pass the actual content objects to calculateDiff, not JSON strings
      // The diff service will handle text extraction internally
      diffResult = await calculateDiff(contentForDiff, previousContent);
      console.log("✅ VERSION SERVER: Diff calculated:", {
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: diffResult.added > 0 || diffResult.removed > 0
      });
    } catch (diffError) {
      console.error("🔴 VERSION SERVER: Error calculating diff (non-fatal):", diffError);
    }

    // Compute fallback diffPreview for new pages (extract text instead of using raw JSON)
    let fallbackDiffPreview = null;
    if (!diffResult?.preview && isNewPage) {
      try {
        const { extractTextContent } = await import('../../utils/text-extraction');
        const textPreview = extractTextContent(data.content).substring(0, 200);
        fallbackDiffPreview = {
          beforeContext: '',
          addedText: textPreview,
          removedText: '',
          afterContext: '',
          hasAdditions: true,
          hasRemovals: false
        };
      } catch (extractError) {
        console.error("🔴 VERSION SERVER: Error extracting text for preview:", extractError);
      }
    }

    // Prepare version data with diff information
    const versionData: Record<string, any> = {
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
      diffPreview: diffResult?.preview || fallbackDiffPreview || {
        beforeContext: '',
        addedText: '',
        removedText: '',
        afterContext: '',
        hasAdditions: diffResult?.added > 0,
        hasRemovals: diffResult?.removed > 0
      },

      // Metadata
      isNewPage: isNewPage,
      isNoOp: false
    };

    // VERSION BATCHING: If this is the first version in a batch group,
    // store the original content so subsequent batches can calculate accurate diffs
    if (data.batchWithGroup && data.groupId) {
      // Store the content that existed BEFORE this edit session started
      // This is used for calculating cumulative diffs across batch updates
      versionData.originalContent = pageData?.content || null;
      versionData.batchCount = 1;
    }

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
    // Cache invalidation doesn't need to block the response
    Promise.allSettled([
      // TODO: User activity recording is disabled because recordUserActivity is a client-side function
      // To re-enable, create a server-side version in app/firebase/streaks-server.ts
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
