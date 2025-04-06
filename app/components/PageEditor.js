"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../providers/AuthProvider";
import SlateEditor from "./SlateEditor";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Globe, Lock } from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";

/**
 * PageEditor Component
 * 
 * A unified editor component that can be used for both editing existing pages and creating new ones.
 * 
 * @param {Object} props
 * @param {string} props.title - Current title of the page
 * @param {Function} props.setTitle - Function to update the title
 * @param {Array} props.initialContent - Initial content for the editor
 * @param {Function} props.onContentChange - Function to handle content changes
 * @param {boolean} props.isPublic - Whether the page is public
 * @param {Function} props.setIsPublic - Function to toggle page visibility
 * @param {Function} props.onSave - Function to handle saving
 * @param {Function} props.onCancel - Function to handle cancellation
 * @param {boolean} props.isSaving - Whether the page is currently being saved
 * @param {string} props.error - Error message to display
 * @param {boolean} props.isNewPage - Whether this is a new page or editing an existing one
 */
const PageEditor = ({
  title,
  setTitle,
  initialContent,
  onContentChange,
  isPublic,
  setIsPublic,
  onSave,
  onCancel,
  isSaving,
  error,
  isNewPage = false
}) => {
  const [currentEditorValue, setCurrentEditorValue] = useState(() =>
    initialContent || [{ type: 'paragraph', children: [{ text: '' }] }]
  );
  const [titleError, setTitleError] = useState(false);
  const { user } = useContext(AuthContext);
  const editorRef = useRef(null);
  const titleInputRef = useRef(null);

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing: true,
    setIsEditing: () => {},
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: !isSaving ? handleSave : null, // Only allow save when not already saving
    isSaving
  });

  useEffect(() => {
    // Focus the editor when entering edit mode
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Update currentEditorValue when the initialContent prop changes
    if (initialContent) {
      setCurrentEditorValue(initialContent);
    }
  }, [initialContent]);

  // Handle content changes
  const handleContentChange = (value) => {
    setCurrentEditorValue(value);
    if (onContentChange) {
      onContentChange(value);
    }
  };

  // Handle save with validation
  function handleSave() {
    if (!user) {
      console.log("User not authenticated");
      return;
    }

    if (!title || title.trim().length === 0) {
      console.log("Title is required");
      setTitleError(true);
      
      // Focus the title input
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
      
      return;
    }
    
    // Clear any title error
    setTitleError(false);

    // Call the provided onSave function
    if (onSave) {
      onSave();
    }
  }

  // Handle link insertion
  const handleInsertLink = () => {
    // Simulate @ key press to trigger link editor
    if (editorRef.current) {
      editorRef.current.focus();
      const atEvent = new KeyboardEvent('keydown', {
        key: '@',
        code: 'KeyAT',
        keyCode: 50,
        which: 50,
        bubbles: true
      });
      document.activeElement.dispatchEvent(atEvent);
    }
  };

  return (
    <div className="editor-container" style={{ paddingBottom: '60px' }}>
      <div className="mb-4">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim().length > 0) {
              setTitleError(false);
            }
          }}
          className={`w-full mt-1 text-3xl font-semibold bg-background text-foreground border ${titleError ? 'border-destructive ring-2 ring-destructive/20' : 'border-input/30 focus:ring-2 focus:ring-primary/20'} rounded-lg px-3 py-2 transition-all break-words overflow-wrap-normal whitespace-normal`}
          placeholder="Enter a title..."
          autoComplete="off"
          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
          autoFocus={isNewPage}
        />
        {titleError && (
          <p className="text-destructive text-sm mt-1">Title is required</p>
        )}
      </div>

      {/* Simple SlateEditor with no nested containers */}
      <SlateEditor
        ref={editorRef}
        initialContent={currentEditorValue}
        onContentChange={handleContentChange}
        onSave={!isSaving ? handleSave : null}
        onDiscard={onCancel}
        onInsert={handleInsertLink}
      />

      {/* Fixed bottom toolbar with public/private switcher and save/cancel buttons */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center z-10">
        <div className="flex items-center gap-4 bg-background/90 backdrop-blur-md shadow-lg p-2 rounded-lg border border-input">
          {/* Public/Private switcher */}
          <div className="flex items-center gap-2">
            {isPublic ? (
              <Globe className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium">
              {isPublic ? "Public" : "Private"}
            </span>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              aria-label="Toggle page visibility"
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border"></div>

          {/* Save/Cancel buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="fixed top-4 right-4 bg-destructive/10 p-4 rounded-md shadow-md">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PageEditor;
