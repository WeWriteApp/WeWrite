"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Plus, FileText, Type, Copy, Link, X, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from '../ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle} from "../ui/dialog";
import LinkEditorModal from '../editor/LinkEditorModal';
import { createPortal } from 'react-dom';

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
  const params = useParams();
  const currentPageId = params?.id;
  const wordCount = selectedText.trim().split(/\s+/).length;

  const handleAddAsTitle = () => {
    const encodedText = encodeURIComponent(selectedText);
    // Exclude current page from new page creation by adding context
    const excludeParam = currentPageId ? `&exclude=${currentPageId}` : '';
    router.push(`/new?title=${encodedText}${excludeParam}`);
    onClose();
  };

  const handleAddAsBody = () => {
    const encodedText = encodeURIComponent(selectedText);
    // Exclude current page from new page creation by adding context
    const excludeParam = currentPageId ? `&exclude=${currentPageId}` : '';
    router.push(`/new?content=${encodedText}${excludeParam}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        aria-describedby="add-to-page-modal-description"
      >
        <DialogHeader>
          <DialogTitle>Add to New Page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p id="add-to-page-modal-description" className="text-sm text-muted-foreground mb-2">Selected text:</p>
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
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Debug effect to track modal state changes
  useEffect(() => {
    console.log('🔗 TEXT_SELECTION: showLinkModal changed to:', showLinkModal);
    if (showLinkModal) {
      console.log('🔗 TEXT_SELECTION: Modal is now open, selectedText:', selectedText);
    }
  }, [showLinkModal, selectedText]);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftChevron, setShowLeftChevron] = useState(false);
  const [showRightChevron, setShowRightChevron] = useState(false);

  // Check for overflow and update chevron visibility
  const checkOverflow = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;

      setShowLeftChevron(scrollLeft > 0);
      setShowRightChevron(scrollLeft < scrollWidth - clientWidth);
    }
  };

  // Handle scroll events
  const handleScroll = () => {
    checkOverflow();
  };

  // Scroll left/right functions
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -100, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 100, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      console.log('🔗 TEXT_SELECTION: Click outside handler triggered', {
        showLinkModal,
        target: event.target,
        targetClass: (event.target as Element)?.className
      });
      // Don't close if link modal is open
      if (showLinkModal) {
        console.log('🔗 TEXT_SELECTION: Link modal is open, not closing menu');
        return;
      }

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        console.log('🔗 TEXT_SELECTION: Closing menu due to click outside');
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // If link modal is open, close it instead of the menu
        if (showLinkModal) {
          setShowLinkModal(false);
        } else {
          onClose();
        }
      }
    };

    // Temporarily disable click outside when link modal might be opening
    if (!showLinkModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, showLinkModal]);

  // Check overflow on mount and when content changes
  useEffect(() => {
    checkOverflow();
    // Add a small delay to ensure DOM is fully rendered
    const timer = setTimeout(checkOverflow, 10);
    return () => clearTimeout(timer);
  }, [enableCopy, enableShare, enableAddToPage]);

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

  const handleOpenLinkModal = (e: React.MouseEvent) => {
    console.log('🔗 TEXT_SELECTION: handleOpenLinkModal called');
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    console.log('🔗 TEXT_SELECTION: Event prevented, current showLinkModal:', showLinkModal);
    console.log('🔗 TEXT_SELECTION: Setting showLinkModal to true...');
    setShowLinkModal(true);
    console.log('🔗 TEXT_SELECTION: setShowLinkModal(true) called');
  };

  const handleModalClose = () => {
    setShowModal(false);
    onClose();
  };

  const handleLinkModalClose = () => {
    console.log('🔗 TEXT_SELECTION: handleLinkModalClose called');
    console.log('🔗 TEXT_SELECTION: Setting showLinkModal to false...');
    setShowLinkModal(false);
    console.log('🔗 TEXT_SELECTION: setShowLinkModal(false) called');
    // Don't close the text selection menu, just the link modal
  };

  const handleInsertLink = (linkData: any) => {
    // For now, we'll just copy the link to clipboard
    // In a full implementation, this would integrate with the editor
    const linkText = linkData.text || linkData.pageTitle || selectedText;
    const linkUrl = linkData.url || (linkData.type === 'external' ? linkData.url : `/${linkData.pageId}`);

    // Create markdown-style link
    const markdownLink = `[${linkText}](${linkUrl})`;

    navigator.clipboard.writeText(markdownLink).then(() => {
      toast({
        title: "Link copied to clipboard",
        description: `Link with text "${linkText}" has been copied as markdown.`,
      });
    }).catch(() => {
      toast({
        title: "Failed to copy link",
        description: "Please try again.",
        variant: "destructive",
      });
    });

    setShowLinkModal(false);
    onClose();
  };

  // Calculate menu position to ensure it stays within viewport
  const menuStyle = {
    left: `${Math.max(10, Math.min(position.x, window.innerWidth - 200))}px`,
    top: `${Math.max(10, position.y)}px`,
    transform: 'translate(-50%, -100%)'};

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden text-selection-menu"
        style={menuStyle}
      >
        <div className="relative flex items-center">
          {/* Left chevron */}
          {showLeftChevron && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 z-10 h-full px-1 bg-gradient-to-r from-background to-transparent hover:from-muted/50 to-transparent transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          {/* Scrollable content container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-1 p-1 overflow-x-auto scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingLeft: showLeftChevron ? '20px' : '4px',
              paddingRight: showRightChevron ? '20px' : '4px'
            }}
            onScroll={handleScroll}
          >
            {enableCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenLinkModal}
              className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
            >
              <Link className="h-3 w-3" />
              Link
            </Button>

            {enableShare && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateLink}
                className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
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
                className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
              >
                <Quote className="h-3 w-3" />
                Add to Page
              </Button>
            )}
          </div>

          {/* Right chevron */}
          {showRightChevron && (
            <button
              onClick={scrollRight}
              className="absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-background to-transparent hover:from-muted/50 to-transparent transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <AddToPageModal
        selectedText={selectedText}
        isOpen={showModal}
        onClose={handleModalClose}
      />

      {showLinkModal && typeof document !== 'undefined' && createPortal(
        <LinkEditorModal
          isOpen={showLinkModal}
          onClose={handleLinkModalClose}
          onInsertLink={handleInsertLink}
          editingLink={null}
          selectedText={selectedText}
        />,
        document.body
      )}
    </>
  );
};

export default UnifiedTextSelectionMenu;