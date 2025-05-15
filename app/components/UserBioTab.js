"use client";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { Button } from "./ui/button";
import { Edit, Save, X, Loader, AlertTriangle } from "lucide-react";
import { rtdb } from "../firebase/rtdb";
import { ref, update, get } from "firebase/database";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { AuthContext } from "../providers/AuthProvider";

// Import the unified editor dynamically to avoid SSR issues
const UnifiedEditor = dynamic(() => import("./UnifiedEditor"), { ssr: false });

export default function UserBioTab({ profile }) {
  const { user } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [bioContent, setBioContent] = useState(profile.bio || "");
  const [originalContent, setOriginalContent] = useState(profile.bio || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastEditor, setLastEditor] = useState(null);
  const [lastEditTime, setLastEditTime] = useState(null);

  // Check if current user is the profile owner
  const isProfileOwner = user && profile && user.uid === profile.uid;

  // Track if content has changed
  const hasUnsavedChanges = isEditing && bioContent !== originalContent;

  // Load the bio content from the database
  useEffect(() => {
    const fetchBioContent = async () => {
      try {
        setIsLoading(true);
        const userRef = ref(rtdb, `users/${profile.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          if (userData.bio) {
            setBioContent(userData.bio);
            setOriginalContent(userData.bio);
          }
          if (userData.bioLastEditor) {
            setLastEditor(userData.bioLastEditor);
          }
          if (userData.bioLastEditTime) {
            setLastEditTime(userData.bioLastEditTime);
          }
        }
      } catch (err) {
        console.error("Error fetching user bio content:", err);
        setError("Failed to load user information. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBioContent();
  }, [profile.uid]);

  // Handle saving the bio content
  const handleSave = async () => {
    try {
      setIsLoading(true);
      const userRef = ref(rtdb, `users/${profile.uid}`);

      await update(userRef, {
        bio: bioContent,
        bioLastEditor: user?.username || user?.displayName || user?.email || "Unknown",
        bioLastEditTime: new Date().toISOString()
      });

      setOriginalContent(bioContent);
      setIsEditing(false);
      setLastEditor(user?.username || user?.displayName || user?.email || "Unknown");
      setLastEditTime(new Date().toISOString());

      toast({
        title: "Success",
        description: "Bio updated successfully",
      });
      return true; // Indicate success for the useUnsavedChanges hook
    } catch (err) {
      console.error("Error updating user bio content:", err);
      setError("Failed to save changes. Please try again.");
      toast({
        title: "Error",
        description: "Failed to update bio",
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
  }, [bioContent]);

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
      setBioContent(originalContent);
      setIsEditing(false);
    }
  };

  // Handle content change in the editor
  const handleContentChange = (content) => {
    setBioContent(content);
  };

  if (isLoading && !bioContent) {
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
        <h2 className="text-xl font-semibold">About {profile.username || "this user"}</h2>
        {isProfileOwner && !isEditing && (
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
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="gap-1"
              disabled={isLoading}
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Content display or editor */}
      <div className="bg-card rounded-lg border border-border p-4">
        {isEditing ? (
          <div className="min-h-[300px]">
            <UnifiedEditor
              initialContent={bioContent}
              onChange={handleContentChange}
              placeholder="Write about yourself..."
              contentType="bio"
            />
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {bioContent ? (
              <div dangerouslySetInnerHTML={{ __html: bioContent }} />
            ) : (
              <div className="text-muted-foreground italic">
                {isProfileOwner
                  ? "You haven't added a bio yet. Click Edit to add one."
                  : "This user hasn't added a bio yet."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last edit info */}
      {lastEditor && lastEditTime && (
        <div className="text-xs text-muted-foreground mt-4">
          <p>Last edited by: {lastEditor} on {new Date(lastEditTime).toLocaleString()}</p>
        </div>
      )}

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
