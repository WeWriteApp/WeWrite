/**
 * WHY: Single text-selection menu for all surfaces (view + edit) to avoid
 * competing toolbars. Hooks into clipboard actions so attribution metadata
 * is consistently applied when users copy shared content.
 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
import FilteredSearchResults from '../search/FilteredSearchResults';
import { useAuth } from '../../providers/AuthProvider';

interface UnifiedTextSelectionMenuProps {
  selectedText: string;
  selectedHtml?: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy?: (text: string) => Promise<{ success: boolean; message: string }>;
  onCreateLink?: (text: string) => { success: boolean; link?: string; message: string };
  enableCopy?: boolean;
  enableShare?: boolean;
  enableAddToPage?: boolean;
  username?: string;
  userId?: string;
  pageId?: string;
  pageTitle?: string;
  canEdit?: boolean;
  setSelectionModalOpen?: (open: boolean) => void;
}

interface AddToPageModalProps {
  selectedText: string;
  selectedHtml: string;
  isOpen: boolean;
  onClose: () => void;
  sourcePageId?: string;
  sourcePageTitle?: string;
  modalRef?: React.RefObject<HTMLDivElement>;
  username?: string;
  sourceUserId?: string;
}

const AddToPageModal: React.FC<AddToPageModalProps> = ({ selectedText, selectedHtml, isOpen, onClose, sourcePageId, sourcePageTitle, modalRef, username, sourceUserId }) => {
  const router = useRouter();
  const params = useParams();
  const currentPageId = params?.id;
  const wordCount = selectedText.trim().split(/\s+/).length;
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

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

  const buildContentFromSelection = (html: string, text: string, attributionMeta: any) => {
    const paragraphs: any[] = [];
    const markPasted = (nodes: any[]) =>
      nodes.map((n) => {
        if (!n) return n;
        const node = { ...n };
        node.metadata = { ...(node.metadata || {}), pasted: true };
        if (node.children) {
          node.children = markPasted(node.children);
        }
        return node;
      });
    if (html && typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const container = doc.body.firstChild as HTMLElement | null;
        let currentChildren: any[] = [];

        const pushParagraph = () => {
          if (currentChildren.length > 0) {
            paragraphs.push({ type: 'paragraph', children: currentChildren });
            currentChildren = [];
          }
        };

        const processNode = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent && node.textContent.length > 0) {
              currentChildren.push({ text: node.textContent });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();

            if (tag === 'br') {
              pushParagraph();
              return;
            }

            if (tag === 'p' || tag === 'div') {
              // Start a new paragraph for block elements
              const savedChildren: any[] = [];
              const prevChildren = currentChildren;
              currentChildren = [];
              el.childNodes.forEach(processNode);
              pushParagraph();
              currentChildren = prevChildren;
              return;
            }

            if (tag === 'a' || el.dataset.linkType || el.classList.contains('page-link') || el.classList.contains('user-link')) {
              const href = el.getAttribute('href') || el.dataset.url || '#';
              const pageId = el.dataset.pageId || (href?.match(/^\/([^\/#]+)/)?.[1]);
              const userIdAttr = el.dataset.userId;
              const isUser = !!userIdAttr;
              const linkText = el.textContent || href;
              const linkNode: any = {
                type: 'link',
                url: href,
                isCustomText: true,
                customText: linkText,
                children: [{ text: linkText }]
              };
              if (isUser) {
                linkNode.isUser = true;
                linkNode.userId = userIdAttr;
              } else if (pageId) {
                linkNode.pageId = pageId;
                linkNode.pageTitle = linkText;
              } else {
                linkNode.isExternal = href.startsWith('http');
              }
              currentChildren.push(linkNode);
              return;
            }

            // Fallback: process children recursively
            el.childNodes.forEach(processNode);
          }
        };

        if (container) {
          container.childNodes.forEach(processNode);
          pushParagraph();
        }
      } catch (err) {
        console.warn('Failed to parse selection HTML, falling back to plain text', err);
      }
    }

    // Fallback to plain text paragraphs if no HTML parsed
    if (paragraphs.length === 0 && text) {
      const lines = text.split('\n');
      lines.forEach((line) => {
        paragraphs.push({ type: 'paragraph', children: [{ text: line }] });
      });
    }

    // Apply pasted metadata and add quotes around first/last text nodes in each paragraph
    const quotedParagraphs = paragraphs.map((para) => {
      const p = { ...para };
      p.children = markPasted(p.children || []);
      const children = p.children;
      if (children && children.length > 0) {
        // Add opening quote to first text child
        for (let i = 0; i < children.length; i++) {
          if (children[i].text) {
            children[i] = { ...children[i], text: `“${children[i].text}` };
            break;
          }
        }
        // Add closing quote to last text child
        for (let i = children.length - 1; i >= 0; i--) {
          if (children[i].text) {
            children[i] = { ...children[i], text: `${children[i].text}”` };
            break;
          }
        }
      }
      p.children = children;
      return p;
    });

    // Append attribution paragraph (suffix only)
    quotedParagraphs.push({
      type: 'paragraph',
      children: [
        { text: '— text from ', metadata: { pasted: true } },
        {
          type: 'link',
          pageId: attributionMeta.sourcePageId,
          pageTitle: attributionMeta.sourcePageTitle,
          url: `/${attributionMeta.sourcePageId}`,
          isCustomText: true,
          customText: attributionMeta.sourcePageTitle,
          children: [{ text: attributionMeta.sourcePageTitle }],
          metadata: { pasted: true }
        },
        { text: ' by ', metadata: { pasted: true } },
        {
          type: 'link',
          isExternal: true,
          url: `/@${attributionMeta.sourceUsername}`,
          isCustomText: true,
          customText: attributionMeta.sourceUsername,
          data: { userId: attributionMeta.sourceUserId },
          children: [{ text: attributionMeta.sourceUsername }],
          metadata: { pasted: true }
        }
      ]
    });

    return quotedParagraphs;
  };

  const appendToPage = async (page: any) => {
    if (!page) {
      toast.error('Select a page first');
      return;
    }

    if (user && page.userId && page.userId !== user.uid) {
      toast.error('You can only append to your own pages');
      return;
    }

    const targetPageId = page.id || page.pageId || page.docId;
    if (!targetPageId) {
      toast.error('Could not determine target page id');
      return;
    }

    const authorUsername = username || user?.username || 'unknown';

    setIsSubmitting(true);
    try {
      const attributionMeta = {
        sourcePageId: sourcePageId || currentPageId,
        sourcePageTitle: sourcePageTitle || 'Source',
        sourceUsername: authorUsername,
        sourceUserId: sourceUserId || user?.uid || 'unknown',
        pastedAt: Date.now()
      };

      const selectionContent = buildContentFromSelection(selectedHtml, selectedText, attributionMeta);

      const body = {
        sourcePageData: {
          id: attributionMeta.sourcePageId,
          title: attributionMeta.sourcePageTitle,
          content: selectionContent,
          userId: user?.uid || null
        }
      };

      const res = await fetch(`/api/pages/${targetPageId}/append-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('🔗 TEXT_SELECTION: Append failed', { status: res.status, data });
        toast.error(data.error || `Failed to append (status ${res.status})`);
        setIsSubmitting(false);
        return;
      }

      console.log('🔗 TEXT_SELECTION: Append succeeded', { targetPageId });
      toast.success(`Appended to "${page.title || 'page'}"`);
      // Redirect to target page in edit mode to show the appended quote
      const targetUrl = `/${targetPageId}?edit=true#appended`;
      console.log('🔗 TEXT_SELECTION: Redirecting to appended page', { targetPageId, targetUrl });
      // Use both router.push and hard redirect as a safety net
      try {
        await router.push(targetUrl);
        // Ensure navigation even if router is blocked
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 300);
      } catch (navError) {
        console.warn('Router navigation failed, falling back to hard redirect', navError);
        window.location.href = targetUrl;
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to append');
      console.error('🔗 TEXT_SELECTION: Append threw error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewPage = async () => {
    if (!newPageTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPageTitle.trim(),
          content: [
            {
              type: 'paragraph',
              children: [{ text: selectedText }]
            }
          ]
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create page');
      }

      const data = await res.json();
      const newPageId = data?.pageId || data?.id;
      toast.success('New page created');
      if (newPageId) {
        await router.push(`/${newPageId}?edit=true#appended`);
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create page');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        aria-describedby="add-to-page-modal-description"
        ref={modalRef}
        data-text-selection-modal
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Add to New Page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p id="add-to-page-modal-description" className="text-sm text-muted-foreground mb-2">Selected text:</p>
            <p className="text-sm font-medium line-clamp-3">"{selectedText}"</p>
          </div>

          {/* Append to existing page */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Append to existing page</p>
            <FilteredSearchResults
              onSelect={async (page, event) => {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                setSelectedPage(page);
                await appendToPage(page);
              }}
              placeholder="Search your pages..."
              preventRedirect={true}
              className="h-full"
              hideCreateButton={true}
              userId={user?.uid || null}
              editableOnly={true}
              onFilterToggle={() => true}
            />
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                appendToPage(selectedPage);
              }}
              disabled={!selectedPage || isSubmitting}
              className="w-full"
              variant="secondary"
            >
              {isSubmitting ? 'Appending...' : selectedPage ? `Append to "${selectedPage.title}"` : 'Select a page'}
            </Button>
          </div>

          {/* Create new page */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Create new page</p>
            <Input
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder="New page title (required)"
              className="w-full"
            />
            <Button
              onClick={handleCreateNewPage}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Creating...' : 'Create new page with selection'}
            </Button>
          </div>

          {/* Quick actions for tiny selections */}
          {wordCount <= 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Quick actions for short selections
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={handleAddAsTitle}
                  variant="secondary"
                  className="justify-start gap-2 h-auto p-3"
                >
                  <Type className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Use as Title</div>
                    <div className="text-xs text-muted-foreground">Start a new page titled with this text</div>
                  </div>
                </Button>
                <Button
                  onClick={handleAddAsBody}
                  variant="secondary"
                  className="justify-start gap-2 h-auto p-3"
                >
                  <FileText className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Use as Body Text</div>
                    <div className="text-xs text-muted-foreground">Start a new page using this as content</div>
                  </div>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UnifiedTextSelectionMenu: React.FC<UnifiedTextSelectionMenuProps> = ({
  selectedText,
  selectedHtml = '',
  position,
  onClose,
  onCopy,
  onCreateLink,
  enableCopy = true,
  enableShare = true,
  enableAddToPage = true,
  username,
  userId,
  pageId,
  pageTitle,
  canEdit = true,
  setSelectionModalOpen
}) => {
  const params = useParams();
  const currentPageId = params?.id as string;
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

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
        showModal,
        target: event.target,
        targetClass: (event.target as Element)?.className
      });
      // Don't close if link modal is open
      if (showLinkModal) {
        console.log('🔗 TEXT_SELECTION: Link modal is open, not closing menu');
        return;
      }
      // Keep menu open while add-to-page modal is open
      if (showModal) {
        // If click is inside the add-to-page dialog, ignore
        if (modalRef.current && modalRef.current.contains(event.target as Node)) {
          return;
        }
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
    if (!showLinkModal && !showModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, showLinkModal, showModal]);

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
    setSelectionModalOpen?.(true);
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
    setSelectionModalOpen?.(false);
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
  const safeX = position ? Math.max(10, Math.min(position.x, window.innerWidth - 200)) : window.innerWidth / 2;
  const safeY = position ? Math.max(10, position.y) : 100;
  const menuStyle = {
    left: `${safeX}px`,
    top: `${safeY}px`,
    transform: 'translate(-50%, -100%)'
  };

  // If we somehow lost position, don't render the menu
  if (!position) return null;

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

            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenLinkModal}
                className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
              >
                <Link className="h-3 w-3" />
                Link
              </Button>
            )}

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
        selectedHtml={selectedHtml}
        isOpen={showModal}
        onClose={handleModalClose}
        sourcePageId={pageId}
        sourcePageTitle={pageTitle}
        modalRef={modalRef}
        username={username}
        sourceUserId={userId}
      />

      {showLinkModal && typeof document !== 'undefined' && createPortal(
        <LinkEditorModal
          isOpen={showLinkModal}
          onClose={handleLinkModalClose}
          onInsertLink={handleInsertLink}
          editingLink={null}
          selectedText={selectedText}
          linkedPageIds={[]}
          currentPageId={currentPageId}
        />,
        document.body
      )}
    </>
  );
};

export default UnifiedTextSelectionMenu;
