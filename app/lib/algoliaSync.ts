/**
 * Algolia Real-time Sync
 *
 * Provides functions to sync pages to Algolia when they are created or updated.
 * Works from both client-side (via API route) and server-side (direct Algolia SDK).
 */

import { getAdminClient, getAlgoliaIndexName, ALGOLIA_INDICES, AlgoliaPageRecord } from './algolia';

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
}

/**
 * Server-side Algolia sync - uses Algolia SDK directly
 * This should be called from server-side code (API routes, database functions)
 */
export async function syncPageToAlgoliaServer(pageData: SyncPageData): Promise<{ success: boolean; error?: string; action?: string }> {
  try {
    const { pageId, title, content, authorId, authorUsername, isPublic, alternativeTitles, lastModified, createdAt, deleted } = pageData;

    if (!pageId) {
      return { success: false, error: 'pageId is required' };
    }

    const client = getAdminClient();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);

    // If page is deleted, remove from Algolia
    if (deleted) {
      try {
        await client.deleteObject({
          indexName,
          objectID: pageId,
        });
        console.log(`[Algolia Sync Server] Deleted page ${pageId} from index`);
        return { success: true, action: 'deleted' };
      } catch (deleteError) {
        console.log(`[Algolia Sync Server] Page ${pageId} not found in index (may have never been synced)`);
        return { success: true, action: 'not_found' };
      }
    }

    // Skip pages without title
    if (!title) {
      console.log(`[Algolia Sync Server] Skipping page ${pageId} - no title`);
      return { success: true, action: 'skipped' };
    }

    // Extract text content from Slate.js format
    const textContent = extractTextFromContent(content);

    // Prepare the Algolia record
    const record: AlgoliaPageRecord = {
      objectID: pageId,
      title,
      content: textContent?.substring(0, 5000), // Limit content size for Algolia
      authorId: authorId || '',
      authorUsername: authorUsername || '',
      isPublic: isPublic ?? true,
      createdAt: createdAt ? new Date(createdAt).getTime() : Date.now(),
      lastModified: lastModified ? new Date(lastModified).getTime() : Date.now(),
      alternativeTitles: alternativeTitles || [],
    };

    // Save to Algolia
    await client.saveObject({
      indexName,
      body: record,
    });

    console.log(`[Algolia Sync Server] Synced page ${pageId}: "${title}"`);
    return { success: true, action: 'synced' };
  } catch (error) {
    console.error('[Algolia Sync Server] Error syncing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Client-side Algolia sync - uses API route
 * This should only be called from client-side code (browser)
 */
export async function syncPageToAlgolia(pageData: SyncPageData): Promise<{ success: boolean; error?: string }> {
  // Check if we're on server-side
  if (typeof window === 'undefined') {
    // Use direct Algolia SDK on server
    return syncPageToAlgoliaServer(pageData);
  }

  // Use API route on client
  try {
    const response = await fetch('/api/algolia/sync-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pageData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Algolia Sync Client] Failed to sync page:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Algolia Sync Client] Page ${pageData.pageId} synced:`, result.action);
    return { success: true };
  } catch (error) {
    console.error('[Algolia Sync Client] Error syncing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Server-side remove page from Algolia - uses Algolia SDK directly
 */
export async function removePageFromAlgoliaServer(pageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getAdminClient();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);

    try {
      await client.deleteObject({
        indexName,
        objectID: pageId,
      });
      console.log(`[Algolia Sync Server] Deleted page ${pageId} from index`);
      return { success: true };
    } catch (deleteError) {
      console.log(`[Algolia Sync Server] Page ${pageId} not found in index`);
      return { success: true }; // Consider it success if not found
    }
  } catch (error) {
    console.error('[Algolia Sync Server] Error removing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a page from Algolia index
 * Call this when a page is deleted
 * Works from both client-side (via API route) and server-side (direct SDK)
 */
export async function removePageFromAlgolia(pageId: string): Promise<{ success: boolean; error?: string }> {
  // Check if we're on server-side
  if (typeof window === 'undefined') {
    // Use direct Algolia SDK on server
    return removePageFromAlgoliaServer(pageId);
  }

  // Use API route on client
  try {
    const response = await fetch(`/api/algolia/sync-page?pageId=${encodeURIComponent(pageId)}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Algolia Sync Client] Failed to remove page:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Algolia Sync Client] Page ${pageId} removed:`, result.action);
    return { success: true };
  } catch (error) {
    console.error('[Algolia Sync Client] Error removing page:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
