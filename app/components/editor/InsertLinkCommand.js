import { $createLinkNode } from '@lexical/react/LexicalLinkPlugin';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';
import { validateLink } from "../../utils/linkValidator";

const INSERT_LINK_COMMAND = 'INSERT_LINK_COMMAND';

function insertLink(editor, url, text, onError = null) {
  if (!url || !text) {
    console.error('URL or text is undefined');
    return;
  }

  try {

  // Determine if this is an external link
  const isExternal = url.startsWith('http://') || url.startsWith('https://');

  // Extract pageId from URL if it's a page link
  let pageId = null;
  if (url.includes('/pages/')) {
    const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
    if (match) {
      pageId = match[1];
    }
  }

  // Create a basic link object for validation
  const basicLink = {
    type: "link",
    url: url,
    children: [{ text: text }],
    isExternal: isExternal,
    pageId: pageId,
    displayText: text
  };

  // CRITICAL FIX: Use validateLink to ensure all required properties are present
  // This ensures backward compatibility with both old and new link formats
  const validatedLink = validateLink(basicLink);
  if (!validatedLink) {
    console.error('Failed to validate link:', basicLink);
    return;
  }
  console.log('InsertLinkCommand: Validated link:', JSON.stringify(validatedLink));

  editor.update(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      // Create the link node
      const linkNode = $createLinkNode(url);

      // Add the text node
      linkNode.append($createTextNode(text));

      // Store validated properties on the node
      // This is a workaround since we can't directly modify the node's properties
      // but we can add custom attributes that will be serialized
      Object.entries(validatedLink).forEach(([key, value]) => {
        if (key !== 'children' && key !== 'type' && key !== 'url') {
          try {
            // For objects and arrays, stringify them
            const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;
            linkNode.setTextContent(key, String(valueToStore));
          } catch (error) {
            console.error('Error storing property on link node:', key, error);
          }
        }
      });

      // Insert the node
      selection.insertNodes([linkNode]);
    }
  });
  } catch (error) {
    console.error('Error in insertLink:', error);
    // Provide user feedback via callback or fallback
    if (onError && typeof onError === 'function') {
      onError('Failed to insert link. Please try again.');
    } else if (typeof window !== 'undefined' && window.alert) {
      // Fallback to alert if no callback provided (for backward compatibility)
      window.alert('Failed to insert link. Please try again.');
    }
  }
}

export { INSERT_LINK_COMMAND, insertLink };
