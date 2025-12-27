/**
 * Typesense Page Sync API Route
 *
 * Syncs a single page to Typesense in real-time.
 * Called when a page is created or updated.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminClient,
  getTypesenseCollectionName,
  TYPESENSE_COLLECTIONS,
  TypesensePageDocument,
  isTypesenseAdminConfigured,
} from '../../../lib/typesense';

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
 * POST /api/typesense/sync-page
 * Sync a single page to Typesense
 */
export async function POST(request: NextRequest) {
  try {
    if (!isTypesenseAdminConfigured()) {
      // Silently skip if Typesense is not configured - allows gradual rollout
      return NextResponse.json({ success: true, action: 'skipped', reason: 'typesense_not_configured' });
    }

    const body = await request.json();
    const { pageId, title, content, authorId, authorUsername, isPublic, alternativeTitles, lastModified, createdAt, deleted } = body;

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      );
    }

    const client = getAdminClient();
    const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);

    // If page is deleted, remove from Typesense
    if (deleted) {
      try {
        await client.collections(collectionName).documents(pageId).delete();
        console.log(`[Typesense Sync] Deleted page ${pageId} from collection`);
        return NextResponse.json({ success: true, action: 'deleted' });
      } catch (deleteError: any) {
        // If document doesn't exist, that's fine
        if (deleteError.httpStatus === 404) {
          console.log(`[Typesense Sync] Page ${pageId} not found in collection (may have never been synced)`);
          return NextResponse.json({ success: true, action: 'not_found' });
        }
        throw deleteError;
      }
    }

    // Skip pages without title
    if (!title) {
      console.log(`[Typesense Sync] Skipping page ${pageId} - no title`);
      return NextResponse.json({ success: true, action: 'skipped', reason: 'no_title' });
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
    };

    // Upsert to Typesense (creates or updates)
    try {
      await client.collections(collectionName).documents().upsert(document);
    } catch (upsertError: any) {
      // If collection doesn't exist, create it and retry
      if (upsertError.httpStatus === 404 && upsertError.message?.includes('Collection')) {
        console.log(`[Typesense Sync] Collection not found, creating...`);
        const { ensureCollectionsExist } = await import('../../../lib/typesense');
        await ensureCollectionsExist();
        await client.collections(collectionName).documents().upsert(document);
      } else {
        throw upsertError;
      }
    }

    console.log(`[Typesense Sync] Synced page ${pageId}: "${title}"`);

    return NextResponse.json({
      success: true,
      action: 'synced',
      pageId,
      title,
    });
  } catch (error) {
    console.error('[Typesense Sync] Error syncing page:', error);
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
 * DELETE /api/typesense/sync-page
 * Remove a page from Typesense (when deleted)
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isTypesenseAdminConfigured()) {
      return NextResponse.json({ success: true, action: 'skipped', reason: 'typesense_not_configured' });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      );
    }

    const client = getAdminClient();
    const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);

    try {
      await client.collections(collectionName).documents(pageId).delete();
      console.log(`[Typesense Sync] Deleted page ${pageId} from collection`);
      return NextResponse.json({ success: true, action: 'deleted' });
    } catch (deleteError: any) {
      if (deleteError.httpStatus === 404) {
        console.log(`[Typesense Sync] Page ${pageId} not found in collection`);
        return NextResponse.json({ success: true, action: 'not_found' });
      }
      throw deleteError;
    }
  } catch (error) {
    console.error('[Typesense Sync] Error deleting page:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
