"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '../ui/drawer';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Save, X } from 'lucide-react';

interface LoggedOutNoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * LoggedOutNoteDrawer Component
 *
 * A simplified note-taking drawer for logged-out users on the landing page.
 * When they click save, it stores their draft and redirects to login.
 * After login/signup, the page is created under their account.
 */
export default function LoggedOutNoteDrawer({ isOpen, onClose }: LoggedOutNoteDrawerProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) {
      // Nothing to save
      onClose();
      return;
    }

    setIsSaving(true);

    // Build the content structure for the new page
    const pageContent = content.trim()
      ? [{ type: "paragraph", children: [{ text: content.trim() }] }]
      : [{ type: "paragraph", children: [{ text: "" }] }];

    // Encode parameters for the URL
    const encodedTitle = encodeURIComponent(title.trim() || 'Untitled');
    const encodedContent = encodeURIComponent(JSON.stringify(pageContent));

    // Build the new page URL
    const newPageUrl = `/new?title=${encodedTitle}&initialContent=${encodedContent}&source=landing-drawer`;

    // Redirect to login with return URL to the new page creation
    router.push(`/auth/login?from=${encodeURIComponent(newPageUrl)}`);

    // Close the drawer
    onClose();
  }, [title, content, router, onClose]);

  const handleClose = useCallback(() => {
    // Clear state and close
    setTitle('');
    setContent('');
    onClose();
  }, [onClose]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent height="70vh">
        <DrawerHeader>
          <DrawerTitle className="text-center">Start Writing</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 px-4 pb-4 flex flex-col gap-4 overflow-y-auto">
          {/* Title Input */}
          <div>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>

          {/* Content Textarea */}
          <div className="flex-1">
            <textarea
              placeholder="Start typing your thoughts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[200px] resize-none border-none bg-transparent px-0 focus:outline-none placeholder:text-muted-foreground/50 text-base leading-relaxed"
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save & Sign In'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
