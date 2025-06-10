"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Plus, FileText, Type, Copy, Link, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '../ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface UnifiedTextSelectionMenuProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy?: (text: string) => Promise<{ success: boolean; message: string }>;
  onCreateLink?: (text: string) => { success: boolean; link?: string; message: string };
  enableCopy?: boolean;
  enableShare?: boolean;
  enableAddToPage?: boolean;
  username?: string;
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
    const encodedText = encodeURIComponent(selectedText);
    router.push(`/new?title=${encodedText}`);
    onClose();
  };

  const handleAddAsBody = () => {
    const encodedText = encodeURIComponent(selectedText);
    router.push(`/new?content=${encodedText}`);
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
                    <div className="text-xs text-muted-foreground">Use as page content</div>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This text will be added as the content of a new page.
              </p>
              <Button onClick={handleAddAsBody} className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Create New Page
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UnifiedTextSelectionMenu: React.FC<UnifiedTextSelectionMenuProps> = ({
  selectedText,
  position,
  onClose,
  onCopy,
  onCreateLink,
  enableCopy = true,
  enableShare = true,
  enableAddToPage = true,
  username
}) => {
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

  const handleCopy = async () => {
    if (onCopy) {
      const result = await onCopy(selectedText);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } else {
      // Fallback copy implementation
      try {
        await navigator.clipboard.writeText(selectedText);
        toast.success('Text copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy text');
      }
    }
    onClose();
  };

  const handleCreateLink = () => {
    if (onCreateLink) {
      const result = onCreateLink(selectedText);
      if (result.success && result.link) {
        navigator.clipboard.writeText(result.link).then(() => {
          toast.success('Link copied to clipboard');
        }).catch(() => {
          toast.error('Failed to copy link');
        });
      } else {
        toast.error(result.message);
      }
    }
    onClose();
  };

  const handleAddToPage = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    onClose();
  };

  // Calculate menu position to ensure it stays within viewport
  const menuStyle = {
    left: `${Math.max(10, Math.min(position.x, window.innerWidth - 200))}px`,
    top: `${Math.max(10, position.y)}px`,
    transform: 'translate(-50%, -100%)',
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-1 flex gap-1"
        style={menuStyle}
      >
        {enableCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="gap-2 text-sm whitespace-nowrap"
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
        )}
        
        {enableShare && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateLink}
            className="gap-2 text-sm whitespace-nowrap"
          >
            <Link className="h-3 w-3" />
            Share
          </Button>
        )}
        
        {enableAddToPage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddToPage}
            className="gap-2 text-sm whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            Add to Page
          </Button>
        )}
      </div>

      <AddToPageModal
        selectedText={selectedText}
        isOpen={showModal}
        onClose={handleModalClose}
      />
    </>
  );
};

export default UnifiedTextSelectionMenu;
