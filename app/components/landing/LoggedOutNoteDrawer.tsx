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
import { Link, X, Check } from 'lucide-react';
import { PageProvider } from '../../contexts/PageContext';
import ContentDisplay from '../content/ContentDisplay';
import { WritingIdeasBanner } from '../writing/WritingIdeasBanner';

interface LoggedOutNoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Editor content node interface
 */
interface EditorNode {
  type: string;
  children: Array<{ text: string }>;
  placeholder?: string;
  [key: string]: any;
}

/**
 * LoggedOutNoteDrawer Component
 *
 * A full-featured note-taking drawer for logged-out users on the landing page.
 * Matches the /new page experience with rich text editing, links, and writing ideas.
 * When they click save, it stores their draft and redirects to registration.
 * After signup, the page is created under their account.
 */
export default function LoggedOutNoteDrawer({ isOpen, onClose }: LoggedOutNoteDrawerProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [editorContent, setEditorContent] = useState<EditorNode[]>([
    { type: "paragraph", children: [{ text: "" }] }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [customPlaceholder, setCustomPlaceholder] = useState("Start typing...");
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);

  // Link insertion trigger function
  const [linkInsertionTrigger, setLinkInsertionTrigger] = useState<(() => void) | null>(null);

  // Handle content changes from editor
  const handleContentChange = useCallback((content: EditorNode[]) => {
    setEditorContent(content);
  }, []);

  // Handle link insertion request from editor
  const handleInsertLinkRequest = useCallback((triggerFn: () => void) => {
    setLinkInsertionTrigger(() => triggerFn);
  }, []);

  // Handle title changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    // Clear selected idea if title is manually changed
    if (selectedIdea && newTitle !== selectedIdea) {
      setSelectedIdea(null);
    }

    // Clear title error when user starts typing
    if (titleError && newTitle.trim()) {
      setTitleError(false);
    }
  };

  // Handle writing idea selection
  const handleIdeaSelect = useCallback((ideaTitle: string, ideaPlaceholder: string) => {
    setTitle(ideaTitle);
    setSelectedIdea(ideaTitle);
    setCustomPlaceholder(ideaPlaceholder);

    if (titleError) {
      setTitleError(false);
    }
  }, [titleError]);

  const handleSave = useCallback(() => {
    // Validate title
    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    setIsSaving(true);

    // Encode parameters for the URL
    const encodedTitle = encodeURIComponent(title.trim());
    const encodedContent = encodeURIComponent(JSON.stringify(editorContent));

    // Build the new page URL
    const newPageUrl = `/new?title=${encodedTitle}&initialContent=${encodedContent}&source=landing-drawer`;

    // Redirect to registration (signup) with return URL to the new page creation
    router.push(`/auth/signup?from=${encodeURIComponent(newPageUrl)}`);

    // Close the drawer
    onClose();
  }, [title, editorContent, router, onClose]);

  const handleClose = useCallback(() => {
    // Clear state and close
    setTitle('');
    setEditorContent([{ type: "paragraph", children: [{ text: "" }] }]);
    setTitleError(false);
    setSelectedIdea(null);
    setCustomPlaceholder("Start typing...");
    onClose();
  }, [onClose]);

  // Check if there's content to save
  const hasContent = title.trim() || editorContent.some(node =>
    node.children?.some((child: any) => child.text?.trim())
  );

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent height="85vh">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">Start Writing</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 px-4 pb-4 flex flex-col gap-4 overflow-y-auto">
          {/* Title Input */}
          <div>
            <Input
              placeholder="Title"
              value={title}
              onChange={handleTitleChange}
              className={`text-lg font-semibold border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50 ${
                titleError ? 'border-destructive ring-destructive' : ''
              }`}
              autoFocus
            />
            {titleError && (
              <p className="text-sm text-destructive mt-1">Please add a title</p>
            )}
          </div>

          {/* Rich Text Editor */}
          <div className="flex-1 min-h-[150px]">
            <PageProvider>
              <ContentDisplay
                content={editorContent}
                isEditable={true}
                onChange={handleContentChange}
                isSaving={isSaving}
                isNewPage={true}
                placeholder={customPlaceholder}
                showToolbar={false}
                onInsertLinkRequest={handleInsertLinkRequest}
              />
            </PageProvider>
          </div>

          {/* Insert Link Button */}
          <div className="flex justify-center">
            <Button
              variant="default"
              size="lg"
              className="gap-2 w-full rounded-2xl font-medium"
              onClick={() => {
                if (linkInsertionTrigger) {
                  linkInsertionTrigger();
                }
              }}
            >
              <Link className="h-5 w-5" />
              <span>Insert Link</span>
            </Button>
          </div>

          {/* Writing Ideas Banner */}
          <div className="mt-2">
            <WritingIdeasBanner
              onIdeaSelect={handleIdeaSelect}
              selectedTitle={selectedIdea || undefined}
              initialExpanded={false}
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2 border-t pt-4">
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
            disabled={isSaving || !hasContent}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save & Sign Up'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
