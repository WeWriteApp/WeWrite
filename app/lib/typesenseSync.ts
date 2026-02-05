/**
 * Typesense Real-time Sync
 *
 * Provides functions to sync pages to Typesense when they are created or updated.
 * Works from both client-side (via API route) and server-side (direct Typesense SDK).
 *
 * Primary search sync service for real-time search updates.
 */

import {
  getAdminClient,
  getTypesenseCollectionName,
  TYPESENSE_COLLECTIONS,
  TypesensePageDocument,
  isTypesenseAdminConfigured,
} from './typesense';

/**
 * Extract plain text from Slate.js editor content
 */
function extractTextFromContent(content: any): string {
  if (!content) return '';

  // If it's a string, try to parse it
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return content;
    }
  }

  // If it's an array (Slate.js format), extract text
  if (Array.isArray(content)) {
    return content
      .map((node: any) => {
        if (node.text) return node.text;
        if (node.children) return extractTextFromContent(node.children);
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

interface SyncPageData {
  pageId: string;
  title: string;
  content?: any;
  authorId: string;
  authorUsername?: string;
  isPublic?: boolean;
  alternativeTitles?: string[];
  lastModified?: string;
  createdAt?: string;
  deleted?: boolean;
  groupId?: string;
  visibility?: string;
}

/**
 * Server-side Typesense sync - uses Typesense SDK directly
 * This should be called from server-side code (API routes, database functions)
 */
export async function syncPageToTypesenseServer(pageData: SyncPageData): Promise<{ success: boolean; error?: string; action?: string }> {
  try {
    // Check if Typesense is configured
    if (!isTypesenseAdminConfigured()) {
      return { success: true, action: 'skipped', error: 'Typesense not configured' };
    }

    const { pageId, title, content, authorId, authorUsername, isPublic, alternativeTitles, lastModified, createdAt, deleted, groupId, visibility } = pageData;

    if (!pageId) {
      return { success: false, error: 'pageId is required' };
    }

    const client = getAdminClient();
    const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);

    // If page is deleted, remove from Typesense
    if (deleted) {
      try {
        await client.collections(collectionName).documents(pageId).delete();
        console.log(`[Typesense Sync Server] Deleted page ${pageId} from collection`);
        return { success: true, action: 'deleted' };
      } catch (deleteError: any) {
        if (deleteError.httpStatus === 404) {
          console.log(`[Typesense Sync Server] Page ${pageId} not found in collection (may have never been synced)`);
          return { success: true, action: 'not_found' };
        }
        throw deleteError;
      }
    }

    // Skip pages without title
    if (!title) {
      console.log(`[Typesense Sync Server] Skipping page ${pageId} - no title`);
      return { success: true, action: 'skipped' };
    }

    // Skip indexing for private pages entirely
    if (visibility === 'private') {
      // Remove from Typesense if it was previously indexed
      try {
        await client.collections(collectionName).documents(pageId).delete();
      } catch {
        // Ignore if not found
      }
      return { success: true, action: 'skipped_private' };
    }

    // Extract text content from Slate.js format
    const textContent = extractTextFromContent(content);

    // Convert timestamps to Unix seconds
    const createdAtUnix = createdAt ? Math.floor(new Date(createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000);
    const lastModifiedUnix = lastModified ? Math.floor(new Date(lastModified).getTime() / 1000) : Math.floor(Date.now() / 1000);

    // Prepare the Typesense document
    const document: TypesensePageDocument = {
      id: pageId,
      title,
      titleLower: title.toLowerCase(),
      content: textContent?.substring(0, 10000), // Limit content size
      authorId: authorId || '',
      authorUsername: authorUsername || '',
      isPublic: isPublic ?? true,
      createdAt: createdAtUnix,
      lastModified: lastModifiedUnix,
      alternativeTitles: alternativeTitles || [],
      ...(groupId && { groupId }),
      ...(visibility && { visibility }),
    };

    // Upsert to Typesense (creates or updates)
    try {
      await client.collections(collectionName).documents().upsert(document);
    } catch (upsertError: any) {
      // If collection doesn't exist, create it and retry
      if (upsertError.httpStatus === 404 && upsertError.message?.includes('Collection')) {
        console.log(`[Typesense Sync Server] Collection not found, creating...`);
        const { ensureCollectionsExist } = await import('./typesense');
        await ensureCollectionsExist();
        await client.collections(collectionName).documents().upsert(document);
      } else {
        throw upsertError;
      }
    }

    console.log(`[Typesense Sync Server] Synced page ${pageId}: "${title}"`);
    return { success: true, action: 'synced' };
  } catch (error) {
    console.error('[Typesense Sync Server] Error syncing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Client-side Typesense sync - uses API route
 * This should only be called from client-side code (browser)
 */
export async function syncPageToTypesense(pageData: SyncPageData): Promise<{ success: boolean; error?: string }> {
  // Check if we're on server-side
  if (typeof window === 'undefined') {
    // Use direct Typesense SDK on server
    return syncPageToTypesenseServer(pageData);
  }

  // Use API route on client
  try {
    const response = await fetch('/api/typesense/sync-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pageData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Typesense Sync Client] Failed to sync page:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Typesense Sync Client] Page ${pageData.pageId} synced:`, result.action);
    return { success: true };
  } catch (error) {
    console.error('[Typesense Sync Client] Error syncing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Server-side remove page from Typesense - uses Typesense SDK directly
 */
export async function removePageFromTypesenseServer(pageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Typesense is configured
    if (!isTypesenseAdminConfigured()) {
      return { success: true }; // Silently succeed if not configured
    }

    const client = getAdminClient();
    const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);

    try {
      await client.collections(collectionName).documents(pageId).delete();
      console.log(`[Typesense Sync Server] Deleted page ${pageId} from collection`);
      return { success: true };
    } catch (deleteError: any) {
      if (deleteError.httpStatus === 404) {
        console.log(`[Typesense Sync Server] Page ${pageId} not found in collection`);
        return { success: true }; // Consider it success if not found
      }
      throw deleteError;
    }
  } catch (error) {
    console.error('[Typesense Sync Server] Error removing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a page from Typesense collection
 * Call this when a page is deleted
 * Works from both client-side (via API route) and server-side (direct SDK)
 */
export async function removePageFromTypesense(pageId: string): Promise<{ success: boolean; error?: string }> {
  // Check if we're on server-side
  if (typeof window === 'undefined') {
    // Use direct Typesense SDK on server
    return removePageFromTypesenseServer(pageId);
  }

  // Use API route on client
  try {
    const response = await fetch(`/api/typesense/sync-page?pageId=${encodeURIComponent(pageId)}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Typesense Sync Client] Failed to remove page:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Typesense Sync Client] Page ${pageId} removed:`, result.action);
    return { success: true };
  } catch (error) {
    console.error('[Typesense Sync Client] Error removing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
