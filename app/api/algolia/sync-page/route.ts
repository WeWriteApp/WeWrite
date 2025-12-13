/**
 * Algolia Page Sync API Route
 *
 * Syncs a single page to Algolia in real-time.
 * Called when a page is created or updated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getAlgoliaIndexName, ALGOLIA_INDICES, AlgoliaPageRecord } from '../../../lib/algolia';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

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

/**
 * POST /api/algolia/sync-page
 * Sync a single page to Algolia
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, title, content, authorId, authorUsername, isPublic, alternativeTitles, lastModified, createdAt, deleted } = body;

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      );
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
        console.log(`[Algolia Sync] Deleted page ${pageId} from index`);
        return NextResponse.json({ success: true, action: 'deleted' });
      } catch (deleteError) {
        // If object doesn't exist, that's fine
        console.log(`[Algolia Sync] Page ${pageId} not found in index (may have never been synced)`);
        return NextResponse.json({ success: true, action: 'not_found' });
      }
    }

    // Skip pages without title
    if (!title) {
      console.log(`[Algolia Sync] Skipping page ${pageId} - no title`);
      return NextResponse.json({ success: true, action: 'skipped', reason: 'no_title' });
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

    console.log(`[Algolia Sync] Synced page ${pageId}: "${title}"`);

    return NextResponse.json({
      success: true,
      action: 'synced',
      pageId,
      title,
    });
  } catch (error) {
    console.error('[Algolia Sync] Error syncing page:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/algolia/sync-page
 * Remove a page from Algolia (when deleted)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      );
    }

    const client = getAdminClient();
    const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);

    try {
      await client.deleteObject({
        indexName,
        objectID: pageId,
      });
      console.log(`[Algolia Sync] Deleted page ${pageId} from index`);
      return NextResponse.json({ success: true, action: 'deleted' });
    } catch (deleteError) {
      console.log(`[Algolia Sync] Page ${pageId} not found in index`);
      return NextResponse.json({ success: true, action: 'not_found' });
    }
  } catch (error) {
    console.error('[Algolia Sync] Error deleting page:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
