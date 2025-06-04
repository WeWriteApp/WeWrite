"use client";

// Types
interface SlateTextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  [key: string]: any;
}

interface SlateElementNode {
  type: string;
  children?: SlateNode[];
  url?: string;
  isExternal?: boolean;
  [key: string]: any;
}

interface SlateContentObject {
  blocks?: Array<{ text?: string }>;
  content?: string | SlateNode[];
  text?: string;
  [key: string]: any;
}

type SlateNode = SlateTextNode | SlateElementNode | string;
type SlateContent = SlateNode[] | string | SlateContentObject;

/**
 * Converts Slate editor content to HTML
 */
export function slateToHtml(content: SlateContent): string {
  console.log("slateToHtml input:", content);
  console.log("slateToHtml input type:", typeof content);

  // If content is already a string and not JSON, return it
  if (typeof content === 'string') {
    try {
      // Check if it's a JSON string
      const parsed = JSON.parse(content);
      console.log("Parsed JSON content:", parsed);
      content = parsed;
    } catch (e) {
      // Not JSON, return as is
      console.log("Not JSON, returning as is");
      return content;
    }
  }

  // If content is null or undefined, return empty string
  if (!content) {
    return '';
  }

  // If content is not an array (but is an object), try to handle common formats
  if (!Array.isArray(content)) {
    console.log("Content is not an array, handling as object");

    // Special case for "[object Object],[object Object],[object Object]" issue
    // This happens when toString() is called on an array of objects
    if (typeof content === 'string' && content.includes('[object Object]')) {
      console.log("Detected [object Object] string, attempting to fix");
      return ""; // Return empty string instead of the [object Object] text
    }

    // If it has a blocks property (another common format)
    if (content.blocks) {
      return content.blocks.map(block => block.text || '').join('<br/>');
    }

    // If it has a content property
    if (content.content) {
      if (typeof content.content === 'string') return content.content;
      if (Array.isArray(content.content)) {
        return content.content.map(item => {
          if (typeof item === 'string') return item;
          return item.text || '';
        }).join('<br/>');
      }
    }

    // If it has a text property
    if (content.text) return content.text;

    // Last resort: stringify the object
    const stringified = String(content);
    if (stringified.includes('[object Object]')) {
      console.log("Stringified content contains [object Object], returning empty string");
      return "";
    }
    return stringified;
  }

  // Process array of Slate nodes
  let html = '';

  // Helper function to process nodes recursively
  const processNode = (node: SlateNode): string => {
    if (typeof node === 'string') {
      return node;
    }

    if (!node) {
      return '';
    }

    // Handle text nodes
    if ('text' in node && node.text !== undefined) {
      let text = node.text;

      // Apply formatting if present
      if (node.bold) {
        text = `<strong>${text}</strong>`;
      }
      if (node.italic) {
        text = `<em>${text}</em>`;
      }
      if (node.underline) {
        text = `<u>${text}</u>`;
      }

      return text;
    }

    // Handle element nodes
    if ('type' in node && node.type) {
      switch (node.type) {
        case 'paragraph':
          if (node.children) {
            const childContent = node.children.map(processNode).join('');
            return `<p>${childContent}</p>`;
          }
          return '<p></p>';

        case 'link':
          if (node.children) {
            const linkText = node.children.map(processNode).join('');
            return `<a href="${node.url || '#'}" ${node.isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>${linkText}</a>`;
          }
          return '';

        default:
          if (node.children) {
            return node.children.map(processNode).join('');
          }
          return '';
      }
    }

    // Handle nodes with children but no type
    if ('children' in node && node.children) {
      return node.children.map(processNode).join('');
    }

    return '';
  };

  // Process each top-level node
  html = (content as SlateNode[]).map(processNode).join('');

  console.log("Generated HTML:", html);
  return html;
}
