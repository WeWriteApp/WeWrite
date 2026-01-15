import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * What Links Here API Route
 *
 * Note: Route path kept as /api/links/backlinks for backward compatibility,
 * but the feature is called "What Links Here" in the UI.
 *
 * GET: Get pages that link to a given page (what links here)
 * POST: Update the what-links-here index for a page
 *
 * This route replaces direct Firebase calls for what-links-here operations
 * and ensures environment-aware collection naming.
 *
 * The Firestore collection remains 'backlinks' to preserve existing data.
 */

interface WhatLinksHereSummary {
  id: string;
  title: string;
  username: string;
  lastModified: any;
  isPublic: boolean;
  linkText?: string;
}

// GET /api/links/backlinks?pageId=xxx&limit=20
// Returns pages that link to the specified page (what links here)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (!pageId) {
      return createErrorResponse('Page ID is required', 'BAD_REQUEST');
    }

    if (limit > 100) {
      return createErrorResponse('Limit cannot exceed 100', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    console.log(`🔍 Getting what-links-here for page ${pageId} (limit: ${limit})`);

    // Query the what-links-here index (collection named 'backlinks' for historical reasons)
    let whatLinksHereQuery = db.collection(getCollectionName('backlinks'))
      .where('targetPageId', '==', pageId)
      .where('isPublic', '==', true)
      .orderBy('lastModified', 'desc');

    if (limit) {
      whatLinksHereQuery = whatLinksHereQuery.limit(limit);
    }

    const whatLinksHereSnapshot = await whatLinksHereQuery.get();

    if (whatLinksHereSnapshot.empty) {
      console.log(`📭 No linking pages found for page ${pageId}`);
      return createApiResponse({
        backlinks: [], // Keep response field name for API compatibility
        count: 0,
        pageId
      });
    }

    const linkedPages: WhatLinksHereSummary[] = whatLinksHereSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.sourcePageId,
        title: data.sourcePageTitle || data.sourceTitle || 'Untitled',
        username: data.sourceUsername || 'Anonymous',
        lastModified: data.lastModified,
        isPublic: data.isPublic,
        linkText: data.linkText
      };
    });

    console.log(`✅ Found ${linkedPages.length} pages linking to page ${pageId}`);

    return createApiResponse({
      backlinks: linkedPages, // Keep 'backlinks' field name for API compatibility
      count: linkedPages.length,
      pageId
    });

  } catch (error) {
    console.error('Error fetching what-links-here:', error);
    return createErrorResponse('Failed to fetch linking pages', 'INTERNAL_ERROR');
  }
}

// POST /api/links/backlinks
// Updates the what-links-here index for a page
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const {
      pageId,
      title,
      username,
      contentNodes,
      isPublic,
      lastModified
    } = body;

    if (!pageId || !title || !username || !contentNodes) {
      return createErrorResponse('Missing required fields: pageId, title, username, contentNodes', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    console.log(`🔄 Updating what-links-here index for page ${pageId}`);

    // Extract links from content nodes
    const extractedLinks = extractLinksFromContent(contentNodes);

    // Remove old what-links-here entries for this page (collection named 'backlinks' for historical reasons)
    const oldEntriesQuery = db.collection(getCollectionName('backlinks'))
      .where('sourcePageId', '==', pageId);

    const oldEntriesSnapshot = await oldEntriesQuery.get();
    const batch = db.batch();

    // Delete old entries
    oldEntriesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new what-links-here entries
    for (const link of extractedLinks) {
      const entryId = `${pageId}_${link.targetPageId}`;
      const entryRef = db.collection(getCollectionName('backlinks')).doc(entryId);

      batch.set(entryRef, {
        sourcePageId: pageId,
        sourcePageTitle: title,
        sourceUsername: username,
        targetPageId: link.targetPageId,
        linkText: link.text || '',
        isPublic: isPublic || false,
        lastModified: lastModified || new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    await batch.commit();

    console.log(`✅ Updated what-links-here index for page ${pageId}: ${extractedLinks.length} links`);

    return createApiResponse({
      success: true,
      message: 'What-links-here index updated successfully',
      pageId,
      linksCount: extractedLinks.length
    });

  } catch (error) {
    console.error('Error updating what-links-here index:', error);
    return createErrorResponse('Failed to update what-links-here index', 'INTERNAL_ERROR');
  }
}

/**
 * Extract links from content nodes
 */
function extractLinksFromContent(contentNodes: any[]): Array<{ targetPageId: string; text?: string }> {
  const links: Array<{ targetPageId: string; text?: string }> = [];

  if (!Array.isArray(contentNodes)) {
    return links;
  }

  function processNode(node: any) {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Check if this node is a link
    if (node.type === 'link' && node.pageId) {
      links.push({
        targetPageId: node.pageId,
        text: node.text || node.displayText || ''
      });
    }

    // Check if this node has a pageId (pill link)
    if (node.pageId && !node.type) {
      links.push({
        targetPageId: node.pageId,
        text: node.text || node.displayText || ''
      });
    }

    // Recursively process children
    if (Array.isArray(node.children)) {
      node.children.forEach(processNode);
    }

    // Process content array if it exists
    if (Array.isArray(node.content)) {
      node.content.forEach(processNode);
    }
  }

  contentNodes.forEach(processNode);

  // Remove duplicates
  const uniqueLinks = links.filter((link, index, self) => 
    index === self.findIndex(l => l.targetPageId === link.targetPageId)
  );

  return uniqueLinks;
}
