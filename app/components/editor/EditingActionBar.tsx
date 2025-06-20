"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { X, Check, Trash2, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface EditingActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onInsertLink?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  className?: string;
  isStatic?: boolean; // New prop to control static vs floating layout
}

export default function EditingActionBar({
  onSave,
  onCancel,
  onDelete,
  onInsertLink,
  isSaving = false,
  hasUnsavedChanges = false,
  className = "",
  isStatic = false
}: EditingActionBarProps) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Detect mobile keyboard opening/closing
  useEffect(() => {
    const initialHeight = window.innerHeight;
    setViewportHeight(initialHeight);

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialHeight - currentHeight;

      // If height decreased by more than 150px, assume keyboard is open
      setIsKeyboardOpen(heightDifference > 150);
      setViewportHeight(currentHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onCancel]);

  const actionBarVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    },
    exit: {
      opacity: 0,
      y: 20,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  // Static layout for positioning below content
  if (isStatic) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex flex-col items-stretch gap-3 w-full md:flex-row md:flex-wrap md:items-center md:justify-center">
          {/* Mobile order: Insert Link, Save, Cancel, Delete */}
          {/* Desktop order: Cancel, Save, Insert Link, Delete (preserved) */}

          {/* Insert Link Button - First on mobile, third on desktop */}
          {onInsertLink && (
            <Button
              variant="outline"
              size="lg"
              onClick={onInsertLink}
              disabled={isSaving}
              className="gap-2 w-full md:w-auto rounded-2xl font-medium order-1 md:order-3"
            >
              <Link className="h-5 w-5" />
              <span>Insert Link</span>
            </Button>
          )}

          {/* Save Button - Second on mobile, second on desktop */}
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="gap-2 w-full md:w-auto rounded-2xl font-medium bg-green-600 hover:bg-green-700 text-white order-2 md:order-2"
            size="lg"
          >
            {isSaving ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                <span>Save</span>
              </>
            )}
          </Button>

          {/* Cancel Button - Third on mobile, first on desktop */}
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={isSaving}
            className="gap-2 w-full md:w-auto rounded-2xl font-medium order-3 md:order-1"
          >
            <X className="h-5 w-5" />
            <span>Cancel</span>
          </Button>

          {/* Delete Button - Last on both mobile and desktop */}
          {onDelete && (
            <Button
              variant="destructive"
              size="lg"
              onClick={onDelete}
              disabled={isSaving}
              className="gap-2 w-full md:w-auto rounded-2xl font-medium text-white order-4 md:order-4"
            >
              <Trash2 className="h-5 w-5" />
              <span>Delete</span>
            </Button>
          )}
        </div>

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && !isSaving && (
          <div className="flex justify-center mt-2">
            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
              <span>Unsaved changes</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Original floating layout
  return (
    <AnimatePresence>
      <motion.div
        variants={actionBarVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`fixed z-50 ${className}`}
        style={{
          bottom: isKeyboardOpen ? '10px' : '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          transition: 'bottom 0.3s ease-in-out'
        }}
      >
        <div className={`
          flex items-center gap-2 px-4 py-2
          bg-background/95 backdrop-blur-sm
          border border-border rounded-2xl shadow-lg
          ${isKeyboardOpen ? 'bg-background border-2' : ''}
        `}>
          {/* Mobile order: Insert Link, Save, Cancel, Delete */}

          {/* Insert Link Button - First on mobile */}
          {onInsertLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={onInsertLink}
              disabled={isSaving}
              className="gap-2 rounded-xl"
            >
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">Insert Link</span>
            </Button>
          )}

          {/* Save Button - Second */}
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </Button>

          {/* Cancel Button - Third */}
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
            className="gap-2 rounded-xl"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>

          {/* Delete Button - Last */}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isSaving}
              className="gap-2 rounded-xl text-white"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}
        </div>

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && !isSaving && (
          <div className="absolute -top-2 -right-2">
            <div className="h-3 w-3 bg-orange-500 rounded-full animate-pulse" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
