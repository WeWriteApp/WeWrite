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
  console.log('BracketTriggerPlugin: Plugin initialized');

  useEffect(() => {
    console.log('BracketTriggerPlugin: Setting up node transform');
    if (!editor) {
      console.error('BracketTriggerPlugin: Editor not available');
      return;
    }
    const removeTransform = editor.registerNodeTransform(TextNode, (textNode) => {
      const textContent = textNode.getTextContent();
      console.log('BracketTriggerPlugin: Checking text content:', textContent);

      if (textContent.includes('[[')) {
        console.log('BracketTriggerPlugin: Creating BracketNode');

        const [beforeBracket, afterBracket] = textContent.split('[[');
        const beforeNode = $createTextNode(beforeBracket);
        const bracketNode = $createBracketNode();

        textNode.replace(beforeNode);
        beforeNode.insertAfter(bracketNode);

        console.log('BracketTriggerPlugin: Editor updated with BracketNode');

        editor.update(() => {
          const selection = $getSelection();
          if (selection) {
            selection.insertNodes([bracketNode]);
          }
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

export { BracketTriggerPlugin as default, BracketNode, $createBracketNode };
