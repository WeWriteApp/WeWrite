import { ElementNode, TextNode } from 'lexical';
import { validateLink } from '../utils/linkValidator';

class CustomLinkNode extends ElementNode {
  __url;
  __validatedProps;

  static getType() {
    return 'custom-link';
  }

  static clone(node) {
    const clonedNode = new CustomLinkNode(node.__url, node.__key);
    clonedNode.__validatedProps = node.__validatedProps;
    return clonedNode;
  }

  constructor(url, key) {
    super(key);
    this.__url = url;

    // CRITICAL FIX: Create default validated properties if none provided
    // This ensures backward compatibility with both old and new link formats
    if (!this.__validatedProps) {
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      const basicLink = {
        type: "link",
        url: url,
        isExternal: isExternal
      };
      this.__validatedProps = validateLink(basicLink);
    }
  }

  createDOM() {
    const a = document.createElement('a');
    a.href = this.__url;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    a.style.color = 'blue';

    // Add data attributes for link type
    if (this.__validatedProps) {
      if (this.__validatedProps.isExternal) {
        a.dataset.linkType = 'external-link';
      } else if (this.__validatedProps.pageId) {
        a.dataset.linkType = 'page-link';
        a.dataset.pageId = this.__validatedProps.pageId;
      }
    }

    return a;
  }

  updateDOM(prevNode, dom) {
    if (prevNode.__url !== this.__url) {
      dom.href = this.__url;
    }
    return false;
  }

  decorate() {
    return null; // No additional decoration needed for now
  }

  exportJSON() {
    // CRITICAL FIX: Include validated properties in the exported JSON
    // This ensures links created with this node will render correctly in view mode

    // Get the children JSON
    const childrenJSON = this.getChildren().map((child) => child.exportJSON());

    // Create a basic link object
    const basicLink = {
      type: 'link', // Use 'link' instead of 'custom-link' for better compatibility
      url: this.__url,
      children: childrenJSON,
      version: 2, // Increment version to indicate the new format
      // Include all validated properties
      ...(this.__validatedProps || {})
    };

    // CRITICAL FIX: Preserve originalPageTitle if available
    if (this.__validatedProps?.pageTitle && !basicLink.originalPageTitle) {
      basicLink.originalPageTitle = this.__validatedProps.pageTitle;
    }

    // CRITICAL FIX: Ensure we have at least one child with text
    if (!childrenJSON || childrenJSON.length === 0) {
      // Create a default text node if none exists
      const displayText = this.__validatedProps?.displayText || 'Link';
      basicLink.children = [{ text: displayText }];
      console.log('CustomLinkNode.exportJSON: Created default children with text:', displayText);
    }

    // Validate the link to ensure all required properties are present
    const validatedLink = validateLink(basicLink);

    // Log the validated link for debugging
    console.log('CustomLinkNode.exportJSON: Validated link:', JSON.stringify(validatedLink));

    return validatedLink;
  }
}

function $createCustomLinkNode(url) {
  return new CustomLinkNode(url);
}

export { CustomLinkNode, $createCustomLinkNode };
