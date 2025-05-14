"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Edit, Save, X, Loader, AlertTriangle } from "lucide-react";
import { rtdb } from "../firebase/rtdb";
import { ref, update, get } from "firebase/database";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

// Import the editor dynamically to avoid SSR issues
const SimpleEditor = dynamic(() => import("./SimpleEditor"), { ssr: false });

export default function GroupAboutTab({ group, canEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [aboutContent, setAboutContent] = useState(group.about || "");
  const [originalContent, setOriginalContent] = useState(group.about || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track if content has changed
  const hasUnsavedChanges = isEditing && aboutContent !== originalContent;

  // Load the about content from the database
  useEffect(() => {
    const fetchAboutContent = async () => {
      try {
        setIsLoading(true);
        const groupRef = ref(rtdb, `groups/${group.id}`);
        const snapshot = await get(groupRef);

        if (snapshot.exists()) {
          const groupData = snapshot.val();
          if (groupData.about) {
            setAboutContent(groupData.about);
            setOriginalContent(groupData.about);
          }
        }
      } catch (err) {
        console.error("Error fetching group about content:", err);
        setError("Failed to load group information. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAboutContent();
  }, [group.id]);

  // Handle saving the about content
  const handleSave = async () => {
    try {
      setIsLoading(true);
      const groupRef = ref(rtdb, `groups/${group.id}`);

      await update(groupRef, {
        about: aboutContent
      });

      setOriginalContent(aboutContent);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Group information updated successfully",
      });
      return true; // Indicate success for the useUnsavedChanges hook
    } catch (err) {
      console.error("Error updating group about content:", err);
      setError("Failed to save changes. Please try again.");
      toast({
        title: "Error",
        description: "Failed to update group information",
        variant: "destructive",
      });
      return false; // Indicate failure for the useUnsavedChanges hook
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave();
  }, [aboutContent]);

  // Use the unsaved changes hook
  const {
    showUnsavedChangesDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasUnsavedChanges, saveChanges);

  // Handle canceling edits with unsaved changes check
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      handleNavigation('/');
    } else {
      // No changes, just exit edit mode
      setAboutContent(originalContent);
      setIsEditing(false);
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    setAboutContent(content);
  };

  if (isLoading && !aboutContent) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Something went wrong</h3>
        <p className="text-muted-foreground text-center mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with edit button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">About this group</h2>
        {canEdit && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-1"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="gap-1"
              disabled={isLoading || isHandlingNavigation}
            >
              {isLoading || isHandlingNavigation ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Content display or editor */}
      <div className="bg-card rounded-lg border border-border p-4">
        {isEditing ? (
          <div className="min-h-[300px]">
            <SimpleEditor
              initialContent={aboutContent}
              onChange={handleContentChange}
              placeholder="Write about this group..."
            />
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {aboutContent ? (
              <div dangerouslySetInnerHTML={{ __html: aboutContent }} />
            ) : (
              <div className="text-muted-foreground italic">
                {canEdit
                  ? "This group doesn't have a description yet. Click Edit to add one."
                  : "This group doesn't have a description yet."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Group creation info */}
      <div className="text-xs text-muted-foreground mt-4">
        <p>Group created: {new Date(group.createdAt).toLocaleDateString()}</p>
      </div>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onClose={handleCloseDialog}
        onStayAndSave={handleStayAndSave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        isSaving={isLoading || isHandlingNavigation}
      />
    </div>
  );
}
