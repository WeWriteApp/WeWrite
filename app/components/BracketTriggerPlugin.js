import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect,useContext,useRef,useState } from "react";
import { LexicalNode, TextNode, DecoratorNode } from "lexical";
import BracketComponent from "./BracketComponent";

class BracketNode extends DecoratorNode {
  static getType() {
    return "bracket";
  }

  static clone(node) {
    return new BracketNode(node.__key);
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
    return <BracketComponent showDropdown={true} />;
  }

  // allow export of the node to JSON with exportJSON
  exportJSON() {
    return {
      type: 'bracket',
      version: 1,
    };
  }

}

function BracketTriggerPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeTransform = editor.registerNodeTransform(TextNode, (textNode) => {
      const text = textNode.getTextContent();
      if (text.endsWith("[[")) {
        const bracketNode = $createBracketNode();
        textNode.insertAfter(bracketNode);
        textNode.remove();
      }
    });

    return () => {
      removeTransform();
    };
  }, [editor]);

  return null;
}

function $createBracketNode() {
  return new BracketNode();
}


export { BracketTriggerPlugin, BracketNode}
