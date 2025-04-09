"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Loader, Save, Edit, X } from "lucide-react";
import SlateEditor from "./SlateEditor";
import { updateDoc } from "../firebase/database";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { toast } from "sonner";

/**
 * BioEditor Component
 *
 * A component for editing a user's bio using the SlateEditor
 *
 * @param {Object} props
 * @param {string} props.userId - The user ID
 * @param {Object} props.initialContent - Initial content for the editor
 * @param {boolean} props.isCurrentUser - Whether the current user is viewing their own profile
 */
export default function BioEditor({ userId, initialContent, isCurrentUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorContent, setEditorContent] = useState(initialContent || [
    { type: "paragraph", children: [{ text: "" }] }
  ]);
  const editorRef = useRef(null);

  // Parse initial content if it's a string
  useEffect(() => {
    if (initialContent) {
      if (typeof initialContent === 'string') {
        try {
          setEditorContent(JSON.parse(initialContent));
        } catch (error) {
          console.error("Error parsing bio content:", error);
          setEditorContent([{ type: "paragraph", children: [{ text: initialContent }] }]);
        }
      } else {
        setEditorContent(initialContent);
      }
    }
  }, [initialContent]);

  // Log the current state for debugging
  useEffect(() => {
    console.log('BioEditor: Current content state:', {
      userId,
      initialContent,
      editorContent,
      isCurrentUser
    });
  }, [userId, initialContent, editorContent, isCurrentUser]);

  // Handle save
  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      // Convert the editorContent to JSON string
      const bioContent = JSON.stringify(editorContent);

      console.log('BioEditor: Saving bio content:', {
        userId,
        bioContent
      });

      // Update the user's bio in Firestore
      await updateDoc("users", userId, {
        bio: bioContent,
        lastModified: new Date().toISOString()
      });

      // Update the user document in the 'users' collection to ensure persistence
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        bio: bioContent,
        lastModified: new Date().toISOString()
      }, { merge: true });

      setIsEditing(false);
      toast.success("Bio updated successfully");
    } catch (error) {
      console.error("Error saving bio:", error);
      toast.error("Failed to save bio");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    // Reset to initial content
    if (initialContent) {
      if (typeof initialContent === 'string') {
        try {
          setEditorContent(JSON.parse(initialContent));
        } catch (error) {
          setEditorContent([{ type: "paragraph", children: [{ text: initialContent }] }]);
        }
      } else {
        setEditorContent(initialContent);
      }
    } else {
      setEditorContent([{ type: "paragraph", children: [{ text: "" }] }]);
    }
  };

  // If not editing, show the bio content with an edit button for the current user
  if (!isEditing) {
    return (
      <div className="relative">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {editorContent && editorContent.length > 0 && editorContent.some(node =>
            node.children && node.children.some(child => child.text && child.text.trim().length > 0)
          ) ? (
            <div className="p-4 border border-border/40 rounded-lg bg-card/50">
              <SlateEditor
                initialContent={editorContent}
                readOnly={true}
              />
            </div>
          ) : (
            <div className="p-4 border border-border/40 rounded-lg bg-card/50 text-muted-foreground text-center">
              {isCurrentUser ? "Add a bio to tell people about yourself" : "This user hasn't added a bio yet"}
            </div>
          )}
        </div>

        {isCurrentUser && (
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </div>
    );
  }

  // Editing mode
  return (
    <div className="border border-border/40 rounded-lg p-4 bg-card/50">
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-sm font-medium">Edit your bio</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      <SlateEditor
        ref={editorRef}
        initialContent={editorContent}
        onContentChange={setEditorContent}
        placeholder="Write something about yourself..."
      />
    </div>
  );
}
