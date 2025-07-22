import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Backlinks API Route
 * 
 * GET: Get backlinks for a page
 * POST: Update backlinks index for a page
 * 
 * This route replaces direct Firebase calls for backlinks operations
 * and ensures environment-aware collection naming.
 */

interface BacklinkSummary {
  id: string;
  title: string;
  username: string;
  lastModified: any;
  isPublic: boolean;
  linkText?: string;
}

// GET /api/links/backlinks?pageId=xxx&limit=20
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

    console.log(`🔍 Getting backlinks for page ${pageId} (limit: ${limit})`);

    // Query the backlinks index
    let backlinksQuery = db.collection(getCollectionName('backlinks'))
      .where('targetPageId', '==', pageId)
      .where('isPublic', '==', true)
      .orderBy('lastModified', 'desc');

    if (limit) {
      backlinksQuery = backlinksQuery.limit(limit);
    }

    const backlinksSnapshot = await backlinksQuery.get();

    if (backlinksSnapshot.empty) {
      console.log(`📭 No backlinks found for page ${pageId}`);
      return createApiResponse({
        backlinks: [],
        count: 0,
        pageId
      });
    }

    const backlinks: BacklinkSummary[] = backlinksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.sourcePageId,
        title: data.sourceTitle || 'Untitled',
        username: data.sourceUsername || 'Anonymous',
        lastModified: data.lastModified,
        isPublic: data.isPublic,
        linkText: data.linkText
      };
    });

    console.log(`✅ Found ${backlinks.length} backlinks for page ${pageId}`);

    return createApiResponse({
      backlinks,
      count: backlinks.length,
      pageId
    });

  } catch (error) {
    console.error('Error fetching backlinks:', error);
    return createErrorResponse('Failed to fetch backlinks', 'INTERNAL_ERROR');
  }
}

// POST /api/links/backlinks
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

    console.log(`🔄 Updating backlinks index for page ${pageId}`);

    // Extract links from content nodes
    const extractedLinks = extractLinksFromContent(contentNodes);
    
    // Remove old backlinks for this page
    const oldBacklinksQuery = db.collection(getCollectionName('backlinks'))
      .where('sourcePageId', '==', pageId);
    
    const oldBacklinksSnapshot = await oldBacklinksQuery.get();
    const batch = db.batch();

    // Delete old backlinks
    oldBacklinksSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new backlinks
    for (const link of extractedLinks) {
      const backlinkId = `${pageId}_${link.targetPageId}`;
      const backlinkRef = db.collection(getCollectionName('backlinks')).doc(backlinkId);
      
      batch.set(backlinkRef, {
        sourcePageId: pageId,
        sourceTitle: title,
        sourceUsername: username,
        targetPageId: link.targetPageId,
        linkText: link.text || '',
        isPublic: isPublic || false,
        lastModified: lastModified || new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    await batch.commit();

    console.log(`✅ Updated backlinks index for page ${pageId}: ${extractedLinks.length} links`);

    return createApiResponse({
      success: true,
      message: 'Backlinks index updated successfully',
      pageId,
      linksCount: extractedLinks.length
    });

  } catch (error) {
    console.error('Error updating backlinks index:', error);
    return createErrorResponse('Failed to update backlinks index', 'INTERNAL_ERROR');
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
