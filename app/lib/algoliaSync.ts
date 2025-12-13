/**
 * Algolia Real-time Sync Client
 *
 * Provides client-side functions to sync pages to Algolia
 * when they are created or updated.
 */

/**
 * Sync a page to Algolia index
 * Call this after creating or updating a page
 */
export async function syncPageToAlgolia(pageData: {
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
}): Promise<{ success: boolean; error?: string }> {
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
 * Remove a page from Algolia index
 * Call this when a page is deleted
 */
export async function removePageFromAlgolia(pageId: string): Promise<{ success: boolean; error?: string }> {
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
