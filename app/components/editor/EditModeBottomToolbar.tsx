"use client";

import React from 'react';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Globe, Lock, Link, X, Check, Trash2 } from "lucide-react";
import MapEditor from "./MapEditor";
import { useFeatureFlag } from "../../utils/feature-flags";
import { useAuth } from "../../providers/AuthProvider";

export interface EditModeBottomToolbarProps {
  isPublic: boolean;
  setIsPublic: (value: boolean) => void;
  location?: { lat: number; lng: number } | null;
  setLocation: (location: { lat: number; lng: number } | null) => void;
  onInsertLink: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  linkFunctionalityEnabled?: boolean;
}

export default function EditModeBottomToolbar({
  isPublic,
  setIsPublic,
  location,
  setLocation,
  onInsertLink,
  onCancel,
  onSave,
  onDelete,
  isSaving = false,
  linkFunctionalityEnabled = true
}: EditModeBottomToolbarProps) {
  const { user } = useAuth();

  // Check if map feature is enabled
  const mapFeatureEnabled = useFeatureFlag('map_view', user?.email);

  return (
    <div className="w-full bg-background border-t border-border mt-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-3">
          {/* Public/Private visibility switcher */}
          <div
            className="flex items-center justify-center gap-2 bg-background/90 p-3 rounded-2xl border border-input cursor-pointer hover:bg-background/95 transition-colors"
            onClick={() => setIsPublic(!isPublic)}
          >
            {isPublic ? (
              <Globe className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
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

          {/* Insert Link button */}
          <Button
            onClick={onInsertLink}
            variant="outline"
            size="lg"
            className={`w-full flex items-center gap-2 bg-background/90 border-input rounded-2xl ${
              !linkFunctionalityEnabled ? 'opacity-60 cursor-pointer' : ''
            }`}
            title={!linkFunctionalityEnabled ? 'Link functionality is temporarily disabled' : 'Insert Link'}
          >
            <Link className="h-4 w-4" />
            <span className="font-medium">Insert Link</span>
          </Button>

          {/* Location button - only show if map feature is enabled */}
          {mapFeatureEnabled && (
            <div className="flex justify-center">
              <MapEditor
                location={location}
                onChange={setLocation}
              />
            </div>
          )}

          {/* Cancel button */}
          <Button
            onClick={onCancel}
            variant="outline"
            size="lg"
            className="w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          {/* Save button (primary action) */}
          <Button
            onClick={onSave}
            disabled={isSaving}
            variant="default"
            size="lg"
            className="w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                <span>Saving...</span>
              </div>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>

          {/* Delete button (only show if onDelete is provided) */}
          {onDelete && (
            <Button
              onClick={onDelete}
              disabled={isSaving}
              variant="destructive"
              size="lg"
              className="w-full rounded-2xl font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
