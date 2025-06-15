import type { LinkData, SlateContent } from "../../types/database";

/**
 * Extract links from Slate.js content nodes
 */
export const extractLinksFromNodes = (nodes: SlateContent[]): LinkData[] => {
  const links: LinkData[] = [];

  const extractFromNode = (node: any) => {
    // Check if this node is a link
    if (node.type === 'link' || node.url || node.href) {
      const linkData: LinkData = {
        url: node.url || node.href || '',
        text: node.text || node.displayText || '',
        type: 'external'
      };

      // Check if it's an internal page link
      if (linkData.url.startsWith('/') || linkData.url.includes('/pages/')) {
        linkData.type = 'page';
        // Extract page ID from URL
        const pageIdMatch = linkData.url.match(/\/pages\/([^\/\?#]+)/);
        if (pageIdMatch) {
          linkData.pageId = pageIdMatch[1];
        } else if (linkData.url.startsWith('/') && !linkData.url.includes('/')) {
          // Handle direct page ID links like "/pageId"
          linkData.pageId = linkData.url.substring(1);
        }
      }

      // Check if it's a user link
      if (linkData.url.includes('/user/') || linkData.url.includes('/users/')) {
        linkData.type = 'user';
        const userIdMatch = linkData.url.match(/\/users?\/([^\/\?#]+)/);
        if (userIdMatch) {
          linkData.userId = userIdMatch[1];
        }
      }

      links.push(linkData);
    }

    // Check if this node has children and recursively extract links
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(extractFromNode);
    }

    // Handle text nodes that might contain link information
    if (node.text && typeof node.text === 'string') {
      // Extract any URLs from plain text
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = node.text.match(urlRegex);
      if (matches) {
        matches.forEach(url => {
          links.push({
            url,
            text: url,
            type: 'external'
          });
        });
      }
    }
  };

  if (Array.isArray(nodes)) {
    nodes.forEach(extractFromNode);
  }

  // Remove duplicates based on URL
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex(l => l.url === link.url)
  );

  return uniqueLinks;
};

/**
 * Find backlinks to a specific page
 */
export const findBacklinks = async (pageId: string, limitCount: number = 10): Promise<LinkData[]> => {
  try {
    // This would typically involve searching through all pages to find links to this page
    // For now, return empty array as this requires a more complex search implementation
    console.log(`Finding backlinks for page ${pageId} (limit: ${limitCount})`);
    return [];
  } catch (error) {
    console.error("Error finding backlinks:", error);
    return [];
  }
};

/**
 * Validate if a link URL is accessible
 */
export const validateLinkUrl = async (url: string): Promise<boolean> => {
  try {
    // For internal links, check if the page exists
    if (url.startsWith('/') || url.includes('/pages/')) {
      const { getPageById } = await import('./pages');
      let pageId = '';
      
      if (url.startsWith('/pages/')) {
        const match = url.match(/\/pages\/([^\/\?#]+)/);
        pageId = match ? match[1] : '';
      } else if (url.startsWith('/')) {
        pageId = url.substring(1);
      }
      
      if (pageId) {
        const result = await getPageById(pageId);
        return !!result.pageData;
      }
    }

    // For external links, we could ping them but that's expensive
    // For now, assume they're valid if they look like URLs
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
  } catch (error) {
    console.error("Error validating link URL:", error);
    return false;
  }
};

/**
 * Extract page references from content
 */
export const extractPageReferences = (content: string | SlateContent[]): string[] => {
  const pageIds: string[] = [];
  
  try {
    let nodes: SlateContent[] = [];
    
    if (typeof content === 'string') {
      nodes = JSON.parse(content);
    } else if (Array.isArray(content)) {
      nodes = content;
    }
    
    const links = extractLinksFromNodes(nodes);
    
    links.forEach(link => {
      if (link.type === 'page' && link.pageId) {
        pageIds.push(link.pageId);
      }
    });
  } catch (error) {
    console.error("Error extracting page references:", error);
  }
  
  // Remove duplicates
  return [...new Set(pageIds)];
};

/**
 * Extract user mentions from content
 */
export const extractUserMentions = (content: string | SlateContent[]): string[] => {
  const userIds: string[] = [];
  
  try {
    let nodes: SlateContent[] = [];
    
    if (typeof content === 'string') {
      nodes = JSON.parse(content);
    } else if (Array.isArray(content)) {
      nodes = content;
    }
    
    const links = extractLinksFromNodes(nodes);
    
    links.forEach(link => {
      if (link.type === 'user' && link.userId) {
        userIds.push(link.userId);
      }
    });
  } catch (error) {
    console.error("Error extracting user mentions:", error);
  }
  
  // Remove duplicates
  return [...new Set(userIds)];
};

/**
 * Convert plain text URLs to link objects
 */
export const convertTextToLinks = (text: string): SlateContent[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const nodes: SlateContent[] = [];
  
  parts.forEach(part => {
    if (part.match(urlRegex)) {
      // This is a URL
      nodes.push({
        type: 'link',
        url: part,
        children: [{ text: part }]
      });
    } else if (part.trim()) {
      // This is regular text
      nodes.push({
        type: 'paragraph',
        children: [{ text: part }]
      });
    }
  });
  
  return nodes.length > 0 ? nodes : [{ type: 'paragraph', children: [{ text }] }];
};

/**
 * Sanitize and normalize link URLs
 */
export const sanitizeLinkUrl = (url: string): string => {
  if (!url) return '';
  
  // Remove any dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
  const lowerUrl = url.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // Ensure external URLs have proper protocol
  if (!url.startsWith('/') && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
};
