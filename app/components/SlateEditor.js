import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
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
import { Search, X } from "lucide-react";

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
      </Slate>

      {showDropdown && (
        <DropdownMenu 
          position={dropdownPosition} 
          onSelect={handleSelection} 
          setShowDropdown={setShowDropdown} 
        />
      )}

      <div className="mt-2 text-center">
        <span className="text-xs text-muted-foreground/60 bg-background/80 px-2 py-1 rounded-md backdrop-blur-sm">
          Press @ to mention a page
        </span>
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


const DropdownMenu = ({ position, onSelect, setShowDropdown }) => {
  const [displayText, setDisplayText] = useState("");
  
  const handleClose = () => {
    setShowDropdown(false);
  };
  
  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleDisplayTextChange = (e) => {
    e.preventDefault(); // Prevent default behavior
    setDisplayText(e.target.value);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] dark:bg-black/50"
        onClick={handleClose}
      />
      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-white dark:bg-zinc-800 rounded-xl shadow-xl z-[1000] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
          {/* Display text section */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Display text</h2>
              <button
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <input
              type="text"
              value={displayText}
              onChange={handleDisplayTextChange}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                }
              }}
              placeholder="Page"
              className="w-full p-3 bg-gray-100 dark:bg-gray-700/50 text-gray-900 dark:text-white rounded-lg border-0 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              autoFocus
            />
          </div>
          
          {/* Link destination section */}
          <div className="p-4 space-y-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Link destination</h2>
            <div className="overflow-y-auto max-h-[40vh]">
              <TypeaheadSearch 
                onSelect={(page) => {
                  onSelect({
                    ...page,
                    title: displayText || page.title
                  });
                }}
                placeholder="Search pages..."
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SlateEditor;
