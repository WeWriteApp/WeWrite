import React, { useState, useContext, useRef } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
} from "slate";
import { Editable, withReact, useSlate, useSelected, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { DataContext } from "../providers/DataProvider";
import { withHistory } from "slate-history";

const SlateEditor = ({ initialEditorState = null, setEditorState }) => {
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

  const handleKeyDown = (event, editor) => {
    if (event.key === "@") {
      event.preventDefault();
      const { selection } = editor;

      if (selection) {
        showDropdownMenu(editor, selection);
      }
    }

    if (event.key === "Escape") {
      setShowDropdown(false);
    }

    // update the editor state
    setEditorState(editor);
  };

  const showDropdownMenu = (editor, selection) => {
    const domRange = ReactEditor.toDOMRange(editor, selection);
    const rect = domRange.getBoundingClientRect();

    setDropdownPosition({
      top: rect.top + window.pageYOffset,
      left: rect.left + window.pageXOffset,
    });

    setShowDropdown(true);
  };

  const handleSelection = (item) => {
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
  const onChange = (newValue) => {
    setEditorState(newValue);
  };

  return (
    <div>
      <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
        <Editable
        renderLeaf={({ attributes, children, leaf }) => {
          return (
            <span
              {...attributes}
              style={{ fontWeight: leaf.bold ? 'bold' : 'normal' }}
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

              {/* show the state of the editor json */}
              <pre>{JSON.stringify(editor, null, 2)}</pre>
      {showDropdown && (
        <DropdownMenu position={dropdownPosition} onSelect={handleSelection} />
      )}
    </div>
  );
};

function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

const withInlines = (editor) => {
  const { insertData, insertText, isInline, isElementReadOnly, isSelectable } =
    editor;

  // make paragraph and link elements inline
  editor.isInline = (element) => {
    return element.type === "link" || isInline(element);
  };

  // make the link element selectable
  editor.isSelectable = (element) => {
    return element.type === "link" || isSelectable(element);
  };

  // make the link element read-only
  editor.isElementReadOnly = (element) => {
    return element.type === "link" || isElementReadOnly(element);
  };

  editor.insertText = (text) => {
    if (text && isUrl(text)) {
      wrapLink(editor, text);
    } else {
      insertText(text);
    }
  };

  editor.insertData = (data) => {
    const text = data.getData("text/plain");

    if (text && isUrl(text)) {
      wrapLink(editor, text);
    } else {
      insertData(data);
    }
  };

  return editor;
};

const Element = (props) => {
  const { attributes, children, element } = props;
  switch (element.type) {
    case "link":
      return <LinkComponent {...props} />;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

const wrapLink = (editor, url) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

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

const unwrapLink = (editor) => {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
};


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

const LinkComponent = ({ attributes, children, element }) => {
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

const insertLink = (editor, url) => {
  if (editor.selection) {
    wrapLink(editor, url);
  }
};

const isLinkActive = (editor) => {
  const [link] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
  return !!link;
};


const DropdownMenu = ({ position, onSelect }) => {
  const { pages } = useContext(DataContext);

  // alphabetically sort the pages
  pages.sort((a, b) => a.title.localeCompare(b.title));

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
      {pages.map((page) => (
        <div
          key={page.id}
          onClick={() => onSelect(page)}
          className="cursor-pointer hover:bg-gray-100"
        >
          {page.title}
        </div>
      ))}
    </div>
  );
};

export default SlateEditor;
