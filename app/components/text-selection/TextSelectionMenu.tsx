"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Plus, FileText, Type } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface TextSelectionMenuProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
}

interface AddToPageModalProps {
  selectedText: string;
  isOpen: boolean;
  onClose: () => void;
}

const AddToPageModal: React.FC<AddToPageModalProps> = ({ selectedText, isOpen, onClose }) => {
  const router = useRouter();
  const wordCount = selectedText.trim().split(/\s+/).length;

  const handleAddAsTitle = () => {
    // Navigate to new page with title pre-filled
    const params = new URLSearchParams({
      title: selectedText.trim(),
      content: ''
    });
    router.push(`/new?${params.toString()}`);
    onClose();
  };

  const handleAddAsBody = () => {
    // Navigate to new page with content pre-filled
    const params = new URLSearchParams({
      title: '',
      content: selectedText.trim()
    });
    router.push(`/new?${params.toString()}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to New Page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Selected text:</p>
            <p className="text-sm font-medium line-clamp-3">"{selectedText}"</p>
          </div>
          
          {wordCount <= 2 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                How would you like to use this text?
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={handleAddAsTitle}
                  variant="outline"
                  className="justify-start gap-2 h-auto p-3"
                >
                  <Type className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Add as Title</div>
                    <div className="text-xs text-muted-foreground">Use as page title with empty content</div>
                  </div>
                </Button>
                <Button
                  onClick={handleAddAsBody}
                  variant="outline"
                  className="justify-start gap-2 h-auto p-3"
                >
                  <FileText className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Add as Body Text</div>
                    <div className="text-xs text-muted-foreground">Use as page content with blank title</div>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This text will be added as the page content with a blank title field.
              </p>
              <Button
                onClick={handleAddAsBody}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New Page
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({ selectedText, position, onClose }) => {
  const [showModal, setShowModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAddToPage = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    onClose();
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-1"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddToPage}
          className="gap-2 text-sm whitespace-nowrap"
        >
          <Plus className="h-3 w-3" />
          Add to Page
        </Button>
      </div>

      <AddToPageModal
        selectedText={selectedText}
        isOpen={showModal}
        onClose={handleModalClose}
      />
    </>
  );
};

export default TextSelectionMenu;
