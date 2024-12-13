import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useContext } from "react";
import { TextNode, DecoratorNode } from "lexical";
import { $createLinkNode } from "@lexical/link";
import { $createTextNode } from "lexical";
import BracketComponent from "./BracketComponent";

class BracketNode extends DecoratorNode {
  __showDropdown;

  constructor(showDropdown = true, key) {
    super(key);
    this.__showDropdown = showDropdown;
  }

  static getType() {
    return "bracket";
  }

  static clone(node) {
    return new BracketNode(node.__showDropdown, node.__key);
  }

  createDOM() {
    const span = document.createElement("span");
    span.style.color = "blue";
    return span;
  }

  updateDOM(prevNode, dom) {
    return false;
  }

  decorate() {
    return <BracketComponent showDropdown={this.__showDropdown} onSelect={(pageId, pageName) => {
      const linkNode = $createLinkNode(`/pages/${pageId}`);
      linkNode.append($createTextNode(pageName));
      return linkNode;
    }} />;
  }

  exportJSON() {
    return {
      type: 'bracket',
      showDropdown: this.__showDropdown,
      version: 1,
    };
  }
}

function BracketTriggerPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeTransform = editor.registerNodeTransform(TextNode, (textNode) => {
      const text = textNode.getTextContent();
      console.log('BracketTriggerPlugin: Checking text content:', text);
      if (text.endsWith("[[")) {
        console.log('BracketTriggerPlugin: Creating BracketNode');
        const bracketNode = $createBracketNode();
        const parent = textNode.getParent();
        textNode.insertAfter(bracketNode);

        // Remove the [[ characters from the text node
        const textContent = text.slice(0, -2);
        if (textContent) {
          textNode.setTextContent(textContent);
        } else {
          textNode.remove();
        }

        // Force editor update to show dropdown
        editor.update(() => {
          console.log('BracketTriggerPlugin: Editor updated with BracketNode');
          bracketNode.getLatest();
        });
      }
    });

    return () => {
      removeTransform();
    };
  }, [editor]);

  return null;
}

function $createBracketNode() {
  return new BracketNode(true);
}

export { BracketTriggerPlugin, BracketNode }
