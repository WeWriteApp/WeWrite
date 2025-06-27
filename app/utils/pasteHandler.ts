/**
 * Paste Handler Utilities for WeWrite Editor
 * 
 * Handles automatic formatting removal when pasting text, while preserving:
 * - Links (automatically converted to URLs)
 * - WeWrite custom formatting for internal pages
 */

/**
 * Detects if pasted content is from WeWrite pages
 */
function isWeWriteContent(html: string): boolean {
  // Check for WeWrite-specific markers
  return html.includes('data-link-type') ||
         html.includes('page-link') ||
         html.includes('user-link') ||
         html.includes('compound-link') ||
         html.includes('class="pill-link"') ||
         html.includes('data-page-id') ||
         html.includes('data-user-id') ||
         html.includes('wewrite.app') || // Domain check for WeWrite URLs
         html.includes('unified-paragraph'); // WeWrite paragraph structure
}

/**
 * Extracts and preserves WeWrite custom formatting
 */
function preserveWeWriteFormatting(html: string): string {
  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Find all WeWrite links and preserve their structure
  const wewriteLinks = tempDiv.querySelectorAll('[data-link-type], .page-link, .user-link, .compound-link, .pill-link');
  
  // Convert to a format that can be safely pasted
  wewriteLinks.forEach(link => {
    const linkType = link.getAttribute('data-link-type');
    const pageId = link.getAttribute('data-id') || link.getAttribute('data-page-id');
    const userId = link.getAttribute('data-user-id');
    const url = link.getAttribute('data-url');
    const text = link.textContent || '';
    
    if (linkType === 'page' && pageId) {
      // Preserve page links
      link.outerHTML = `<span data-link-type="page" data-id="${pageId}" data-page-title="${text}" class="page-link pill-link">${text}</span>`;
    } else if (linkType === 'user' && userId) {
      // Preserve user links
      link.outerHTML = `<span data-link-type="user" data-user-id="${userId}" class="user-link pill-link">${text}</span>`;
    } else if (linkType === 'external' && url) {
      // Preserve external links
      link.outerHTML = `<span data-link-type="external" data-url="${url}" class="external-link pill-link">${text}</span>`;
    }
  });
  
  return tempDiv.innerHTML;
}

/**
 * Extracts URLs from text and converts them to clickable links
 */
function convertURLsToLinks(text: string): string {
  // Enhanced URL regex pattern that handles more cases
  const urlRegex = /(https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*)?(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)/gi;

  return text.replace(urlRegex, (url) => {
    // Clean up the URL (remove trailing punctuation that's likely not part of the URL)
    const cleanUrl = url.replace(/[.,;:!?]+$/, '');
    // Escape HTML entities in the URL for safety
    const escapedUrl = cleanUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span data-link-type="external" data-url="${escapedUrl}" class="external-link pill-link">${escapedUrl}</span>`;
  });
}

/**
 * Strips all formatting except for preserved elements
 */
function stripFormatting(html: string): string {
  // Create a temporary DOM element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Get all text nodes and preserved elements
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // Preserve WeWrite links and line breaks
          if (element.hasAttribute('data-link-type') || 
              element.classList.contains('pill-link') ||
              element.tagName === 'BR' ||
              element.tagName === 'P' ||
              element.tagName === 'DIV') {
            return NodeFilter.FILTER_ACCEPT;
          }
        }
        
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const preservedNodes: Node[] = [];
  let node;
  while (node = walker.nextNode()) {
    preservedNodes.push(node);
  }
  
  // Rebuild content with only preserved elements
  const result = document.createElement('div');
  let currentP = document.createElement('p');
  result.appendChild(currentP);
  
  preservedNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        currentP.appendChild(document.createTextNode(text));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.tagName === 'BR' || element.tagName === 'P' || element.tagName === 'DIV') {
        // Start a new paragraph
        if (currentP.textContent?.trim() || currentP.children.length > 0) {
          currentP = document.createElement('p');
          result.appendChild(currentP);
        }
      } else if (element.hasAttribute('data-link-type') || element.classList.contains('pill-link')) {
        // Preserve the link element
        currentP.appendChild(element.cloneNode(true));
      }
    }
  });
  
  // Clean up empty paragraphs
  const paragraphs = result.querySelectorAll('p');
  paragraphs.forEach(p => {
    if (!p.textContent?.trim() && p.children.length === 0) {
      p.remove();
    }
  });
  
  return result.innerHTML;
}

/**
 * Main paste handler function
 */
export function handlePaste(event: ClipboardEvent): { preventDefault: boolean; content?: string } {
  try {
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return { preventDefault: false };
    }

    // Get both HTML and plain text
    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');

    // If no data, let browser handle it
    if (!htmlData && !textData) {
      return { preventDefault: false };
    }

    let processedContent: string;

    if (htmlData && isWeWriteContent(htmlData)) {
      // Preserve WeWrite formatting
      console.log('Detected WeWrite content, preserving custom formatting');
      processedContent = preserveWeWriteFormatting(htmlData);
    } else if (htmlData) {
      // Strip all formatting but preserve structure
      console.log('Stripping formatting from HTML content');
      const strippedContent = stripFormatting(htmlData);

      // Extract plain text and convert URLs
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = strippedContent;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      processedContent = convertURLsToLinks(plainText);
    } else {
      // Plain text - just convert URLs to links
      console.log('Processing plain text content');
      processedContent = convertURLsToLinks(textData);
    }

    // Ensure we have some content to paste
    if (!processedContent || processedContent.trim() === '') {
      return { preventDefault: false };
    }

    return {
      preventDefault: true,
      content: processedContent
    };
  } catch (error) {
    console.error('Error processing paste content:', error);
    // Fall back to browser default behavior on error
    return { preventDefault: false };
  }
}

/**
 * Inserts processed content into the editor at cursor position
 */
export function insertProcessedContent(content: string): void {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.warn('No selection available for content insertion');
      return;
    }

    const range = selection.getRangeAt(0);

    // Delete any selected content
    range.deleteContents();

    // Create a temporary container for the content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Insert each child node
    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    // Insert the content
    range.insertNode(fragment);

    // Move cursor to end of inserted content
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    console.log('Successfully inserted processed content');
  } catch (error) {
    console.error('Error inserting processed content:', error);
    // Fallback: try using execCommand if available
    try {
      if (document.execCommand) {
        document.execCommand('insertHTML', false, content);
      }
    } catch (fallbackError) {
      console.error('Fallback insertion also failed:', fallbackError);
    }
  }
}
