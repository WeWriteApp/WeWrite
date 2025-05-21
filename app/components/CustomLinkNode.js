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
    return {
      type: 'custom-link',
      url: this.__url,
      children: this.getChildren().map((child) => child.exportJSON()),
      version: 1,
      // Include all validated properties
      ...(this.__validatedProps || {})
    };
  }
}

function $createCustomLinkNode(url) {
  return new CustomLinkNode(url);
}

export { CustomLinkNode, $createCustomLinkNode };
