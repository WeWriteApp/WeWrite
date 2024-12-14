import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useContext } from "react";
import { TextNode, DecoratorNode } from "lexical";
import { $createLinkNode } from "@lexical/link";
import { $createTextNode, $createRangeSelection, $setSelection } from "lexical";
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

  getTextContent() {
    return "[[";
  }

  setShowDropdown(show) {
    const self = this.getWritable();
    self.__showDropdown = show;
    return self;
  }

  getShowDropdown() {
    return this.__showDropdown;
  }

  getChildren() {
    return [];
  }

  getChildrenSize() {
    return 0;
  }

  getChildAtIndex(index) {
    return null;
  }

  insertNewAfter() {
    return null;
  }

  collapseAtStart() {
    return true;
  }

  decorate() {
    return <BracketComponent node={this} />;
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
        console.log('BracketTriggerPlugin: Found trigger, creating BracketNode');

        const [beforeBracket, afterBracket] = textContent.split('[[');
        const beforeNode = $createTextNode(beforeBracket);
        const bracketNode = $createBracketNode();
        bracketNode.setShowDropdown(true);

        textNode.replace(beforeNode);
        beforeNode.insertAfter(bracketNode);

        editor.update(() => {
          const selection = $createRangeSelection();
          selection.anchor.set(bracketNode.getKey(), 0, 'element');
          selection.focus.set(bracketNode.getKey(), 0, 'element');
          $setSelection(selection);
        });

        console.log('BracketTriggerPlugin: Editor updated with BracketNode, dropdown should be visible');
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
