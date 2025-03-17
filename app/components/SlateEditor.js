import React, { useState, useContext, useRef, forwardRef, useImperativeHandle } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Path,
} from "slate";
import { Editable, withReact, useSlate, useSelected, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { DataContext } from "../providers/DataProvider";
import { withHistory } from "slate-history";
import TypeaheadSearch from "./TypeaheadSearch";

const SlateEditor = forwardRef(({ initialEditorState = null, setEditorState }, ref) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({});
  const editableRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      try {
        ReactEditor.focus(editor);
        
        // If there's no content, add an empty paragraph
        if (editor.children.length === 0) {
          Transforms.insertNodes(editor, {
            type: 'paragraph',
            children: [{ text: '' }],
          });
        }

        // Find the last text node
        const lastNode = Editor.last(editor, []);
        if (lastNode) {
          const [node, path] = lastNode;
          
          // Create a new selection at the end of the last text node
          const point = { path, offset: node.text.length };
          Transforms.select(editor, point);
        }
      } catch (error) {
        console.error('Error focusing editor:', error);
      }
    }
  }));

  const [initialValue, setInitialValue] = useState(initialEditorState || [
    {
      type: "paragraph",
      children: [{ text: "" }],
    },
  ]);

  const handleKeyDown = (event, editor) => {
    // Handle cmd+enter to save
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      // TODO: Implement save functionality
      return;
    }

    // Shift+enter should do nothing
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      return;
    }

    // Regular enter should create a newline
    if (event.key === 'Enter') {
      // Allow default behavior which creates a newline
      return;
    }

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
  };

  const showDropdownMenu = () => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
  
    const range = selection.getRangeAt(0).cloneRange();
    const rect = range.getBoundingClientRect();
  
    setDropdownPosition({
      top: rect.bottom + window.pageYOffset, // Adjust based on caret position
      left: rect.left + window.pageXOffset,  // Adjust based on caret position
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
    <div className="relative rounded-lg bg-background">
      <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
        <div className="relative">
          <Editable
            ref={editableRef}
            renderLeaf={({ attributes, children, leaf }) => {
              return (
                <span
                  {...attributes}
                  style={{ fontWeight: leaf.bold ? 'bold' : 'normal' }}
                  className="transition-colors"
                >
                  {children}
                </span>
              )
            }}
            renderElement={(props) => <Element {...props} />}
            onKeyDown={(event) => handleKeyDown(event, editor)}
            placeholder="Start writing..."
            className="min-h-[200px] px-4 py-3 prose prose-sm max-w-none prose-neutral dark:prose-invert prose-p:leading-7 prose-headings:font-semibold focus:outline-none"
          />

          {showDropdown && (
            <DropdownMenu position={dropdownPosition} onSelect={handleSelection} showDropdown={showDropdown} />
          )}
        </div>
      </Slate>

      <div className="mt-4 text-xs text-muted-foreground/60 bg-background/80 px-2 py-1 rounded-md backdrop-blur-sm inline-block">
        Press @ to mention a page
      </div>
    </div>
  );
});

SlateEditor.displayName = 'SlateEditor';

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

const isLinkActive = (editor) => {
  const [link] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
  return !!link;
};


const DropdownMenu = ({ position, onSelect,setShowDropdown }) => {
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
      <TypeaheadSearch onSelect={onSelect} setShowDropdown={setShowDropdown} />
    </div>
  );
};

export default SlateEditor;
