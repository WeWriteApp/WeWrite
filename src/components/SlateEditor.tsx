import React, { useState, useContext, useRef } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Range
} from "slate";
import { Editable, withReact, useSlate, useSelected, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { DataContext } from "../providers/DataProvider";
import { withHistory } from "slate-history";
// import TypeaheadSearch from "./TypeaheadSearch";

const SlateEditor = ({ initialEditorState = null, setEditorState}:any) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({});
  const [editorRef, setEditorRef] = useState(null);
  const [initialValue, setInitialValue] = useState(initialEditorState || [
    {
      type: "paragraph",
      children: [{ text: "" }],
    },
  ]);

  const handleKeyDown = (event: any, editor: any) => {
    if (event.key === "@") {
      event.preventDefault();
      const { selection } = editor;

      if (selection) {
        showDropdownMenu();
      }
    }

    if (event.key === "Escape") {
      setShowDropdown(false);
    }

  };

  const showDropdownMenu = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount === 0) return;

    const range = selection?.getRangeAt(0).cloneRange();
    const rect: any = range?.getBoundingClientRect();

    setDropdownPosition({
      top: rect.bottom + window.pageYOffset, // Adjust based on caret position
      left: rect.left + window.pageXOffset,  // Adjust based on caret position
    });

    setShowDropdown(true);
  };


  const handleSelection = (item: any) => {
    const link = {
      type: "link",
      url: `/pages/${item.id}`,
      children: [{ text: item.title }],
    };
    Transforms.insertNodes(editor, link, { at: editor.selection });
    // after insert -- move the cursor to the end of the link
    Transforms.collapse(editor, { edge: "end" });

    // position the cursor at the end of the new link
    Transforms.select(editor, Editor.end(editor, []));

    // insert a space after the link
    Transforms.insertText(editor, ' ');

    ReactEditor.focus(editor);

    // hide the dropdown
    setShowDropdown(false);
  };

  // onchange handler
  const onChange = (newValue: any) => {
    setEditorState(newValue);
  };

  return (
    <div className="border border-white/30 rounded-xl p-4 relative bg-white/15">
      <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
        <Editable
          renderLeaf={({ attributes, children, leaf }: any) => {
            return (
              <span
                {...attributes}
                style={{ fontWeight: leaf?.bold ? 'bold' : 'normal' }}
              >
                {children}
              </span>
            )
          }}
          renderElement={(props) => <Element {...props} />}
          onKeyDown={(event) => handleKeyDown(event, editor)}
          placeholder="Enter some text..."
        />
      </Slate>

      {showDropdown && (
        <DropdownMenu position={dropdownPosition} onSelect={handleSelection} setShowDropdown={setShowDropdown} />
      )}

      <pre className="text-xs text-gray-500 mt-2">
        Press @ to mention a page
      </pre>
    </div>
  );
};

function isUrl(string: string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

const withInlines = (editor: any) => {
  const { insertData, insertText, isInline, isElementReadOnly, isSelectable } =
    editor;

  // make paragraph and link elements inline
  editor.isInline = (element: any) => {
    return element.type === "link" || isInline(element);
  };

  // make the link element selectable
  editor.isSelectable = (element: any) => {
    return element.type === "link" || isSelectable(element);
  };

  // make the link element read-only
  editor.isElementReadOnly = (element: any) => {
    return element.type === "link" || isElementReadOnly(element);
  };

  editor.insertText = (text: string) => {
    if (text && isUrl(text)) {
      wrapLink(editor, text);
    } else {
      insertText(text);
    }
  };

  editor.insertData = (data: any) => {
    const text = data.getData("text/plain");

    if (text && isUrl(text)) {
      wrapLink(editor, text);
    } else {
      insertData(data);
    }
  };

  return editor;
};

const Element = (props: any) => {
  const { attributes, children, element } = props;
  switch (element.type) {
    case "link":
      return <LinkComponent {...props} />;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

const wrapLink = (editor: any, url: string) => {
  // if (isLinkActive(editor)) {
  //   unwrapLink(editor);
  // }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link = {
    type: "link",
    url,
    children: isCollapsed ? [{ text: url }] : [],
  };

  if (isCollapsed) {
    Transforms.insertNodes(editor, link);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: "end" });
  }
};

// const unwrapLink = (editor: any) => {
//   Transforms.unwrapNodes(editor, {
//     match: (n) =>
//       !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
//   });
// };


const InlineChromiumBugfix = () => (
  <span
    contentEditable={false}
    style={{
      display: "inline-block",
      width: 0,
      height: 0,
      lineHeight: 0,
    }}
  >
    {String.fromCodePoint(160) /* Non-breaking space */}
  </span>
);

interface LinkComponentProps {
  attributes: any;
  children: any;
  element: any;
}

const LinkComponent: React.FC<LinkComponentProps> = ({attributes, children, element}) => {
  const selected = useSelected();
  return (
    <a
      {...attributes}
      href={element.url}
      style={{
        color: "blue",
        textDecoration: "underline",
        cursor: selected ? "text" : "pointer",
      }}
    >
      <InlineChromiumBugfix />
      {children}
      <InlineChromiumBugfix />
    </a>
  );
};

// const isLinkActive = (editor: any) => {
//   const [link] = Editor.nodes(editor, {
//     match: (n: any) =>
//       !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
//   });
//   return !!link;
// };


interface DropdownMenuProps {
  position: any;
  onSelect: any;
  setShowDropdown: any;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ position, onSelect, setShowDropdown }) => {
  // if user clicks outside of the dropdown, hide it
  return (
    <div
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        background: "white",
        border: "1px solid #ccc",
        padding: "4px",
        borderRadius: "4px",
        zIndex: 1000,
      }}
    >
      {/* <TypeaheadSearch onSelect={onSelect} setShowDropdown={setShowDropdown} /> MMM */}
    </div>
  );
};

export default SlateEditor;
