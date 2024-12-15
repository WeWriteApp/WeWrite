import { ElementNode, TextNode } from 'lexical';

class CustomLinkNode extends ElementNode {
  __url;

  static getType() {
    return 'custom-link';
  }

  static clone(node) {
    return new CustomLinkNode(node.__url, node.__key);
  }

  constructor(url, key) {
    super(key);
    this.__url = url;
  }

  createDOM() {
    const a = document.createElement('a');
    a.href = this.__url;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    a.style.color = 'blue';
    return a;
  }

  updateDOM(prevNode, dom) {
    if (prevNode.__url !== this.__url) {
      dom.href = this.__url;
    }
    return false;
  }

  decorate() {
    return null;
  }

  static importJSON(serializedNode) {
    const node = new CustomLinkNode(serializedNode.url);

    const children = serializedNode.children;
    if (Array.isArray(children)) {
      const childNodes = children.map((child) => {
        if (child.type === 'text') {
          return TextNode.importJSON(child);
        }
        return null;
      }).filter(Boolean);

      if (childNodes.length > 0) {
        node.append(...childNodes);
      }
    }

    return node;
  }

  exportJSON() {
    return {
      type: 'custom-link',
      url: this.__url,
      children: this.getChildren().map((child) => child.exportJSON()),
      version: 1,
    };
  }
}

function $createCustomLinkNode(url) {
  return new CustomLinkNode(url);
}

export { CustomLinkNode, $createCustomLinkNode };
