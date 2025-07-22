import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Link Extraction API Route
 * 
 * POST: Extract links from content and find linked pages
 * 
 * This route replaces direct Firebase calls for link extraction operations
 * and ensures environment-aware collection naming.
 */

interface ExtractedLink {
  pageId: string;
  text: string;
  displayText?: string;
  exists: boolean;
  pageData?: {
    title: string;
    username: string;
    isPublic: boolean;
    lastModified: string;
  };
}

// POST /api/links/extract
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, validatePages = true } = body;

    if (!content) {
      return createErrorResponse('Content is required', 'BAD_REQUEST');
    }

    // Extract links from content
    const extractedLinks = extractLinksFromContent(content);

    if (!validatePages) {
      // Return just the extracted links without validation
      return createApiResponse({
        links: extractedLinks.map(link => ({
          pageId: link.pageId,
          text: link.text,
          exists: false // Not validated
        })),
        count: extractedLinks.length,
        validated: false
      });
    }

    // Validate links against database
    const admin = initAdmin();
    const db = admin.firestore();

    const validatedLinks: ExtractedLink[] = [];

    for (const link of extractedLinks) {
      try {
        const pageDoc = await db.collection(getCollectionName('pages')).doc(link.pageId).get();
        
        if (pageDoc.exists()) {
          const pageData = pageDoc.data();
          validatedLinks.push({
            pageId: link.pageId,
            text: link.text,
            displayText: link.displayText,
            exists: true,
            pageData: {
              title: pageData?.title || 'Untitled',
              username: pageData?.username || 'Anonymous',
              isPublic: pageData?.isPublic || false,
              lastModified: pageData?.lastModified || ''
            }
          });
        } else {
          validatedLinks.push({
            pageId: link.pageId,
            text: link.text,
            displayText: link.displayText,
            exists: false
          });
        }
      } catch (error) {
        console.warn(`Error validating link ${link.pageId}:`, error);
        validatedLinks.push({
          pageId: link.pageId,
          text: link.text,
          displayText: link.displayText,
          exists: false
        });
      }
    }

    return createApiResponse({
      links: validatedLinks,
      count: validatedLinks.length,
      validated: true,
      summary: {
        total: validatedLinks.length,
        existing: validatedLinks.filter(link => link.exists).length,
        missing: validatedLinks.filter(link => !link.exists).length
      }
    });

  } catch (error) {
    console.error('Error extracting links:', error);
    return createErrorResponse('Failed to extract links', 'INTERNAL_ERROR');
  }
}

/**
 * Extract links from content nodes
 */
function extractLinksFromContent(content: any): Array<{ pageId: string; text: string; displayText?: string }> {
  const links: Array<{ pageId: string; text: string; displayText?: string }> = [];

  if (!content) {
    return links;
  }

  // Handle different content formats
  let contentNodes: any[] = [];

  if (typeof content === 'string') {
    try {
      contentNodes = JSON.parse(content);
    } catch (error) {
      console.warn('Could not parse content as JSON:', error);
      return links;
    }
  } else if (Array.isArray(content)) {
    contentNodes = content;
  } else if (typeof content === 'object') {
    // Single node
    contentNodes = [content];
  }

  function processNode(node: any) {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Check if this node is a link
    if (node.type === 'link' && node.pageId) {
      links.push({
        pageId: node.pageId,
        text: node.text || '',
        displayText: node.displayText || node.text || ''
      });
    }

    // Check if this node has a pageId (pill link)
    if (node.pageId && !node.type) {
      links.push({
        pageId: node.pageId,
        text: node.text || '',
        displayText: node.displayText || node.text || ''
      });
    }

    // Check for pageId in various formats
    if (node.pageId) {
      links.push({
        pageId: node.pageId,
        text: node.text || node.displayText || '',
        displayText: node.displayText || node.text || ''
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

    // Process nested structures
    if (node.data && typeof node.data === 'object') {
      processNode(node.data);
    }
  }

  contentNodes.forEach(processNode);

  // Remove duplicates based on pageId
  const uniqueLinks = links.filter((link, index, self) => 
    index === self.findIndex(l => l.pageId === link.pageId)
  );

  return uniqueLinks;
}
