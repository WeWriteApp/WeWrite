"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Loader, ChevronLeft, ChevronRight, Share2, MoreHorizontal, Edit2, Plus, MessageSquare, Trash2, Link as LinkIcon, AlignJustify, AlignLeft, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { ref, get } from "firebase/database";
import { rtdb } from "../../firebase/rtdb";
import dynamic from 'next/dynamic';

import { UsernameBadge } from "../ui/UsernameBadge";

import ClickableByline from "../utils/ClickableByline";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useDateFormat } from '../../contexts/DateFormatContext';
import { handleAddToPage, handleReply, handleShare } from "../../utils/pageActionHandlers";

import { useSidebarContext } from "../layout/UnifiedSidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "../ui/dropdown-menu";
import { Switch } from "../ui/switch";
import { DateFormatPicker } from "../ui/date-format-picker";
import {
  navigateToPreviousDailyNote,
  navigateToNextDailyNote,
  isExactDateFormat as isDailyNoteFormat
} from "../../utils/dailyNoteNavigation";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext";
import { Logo } from "../ui/Logo";

// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('../utils/AddToPageButton'), {
  ssr: false,
  loading: () => null
});

/**
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 * @deprecated Use isDailyNoteFormat from dailyNoteNavigation utils instead
 */
const isExactDateFormat = isDailyNoteFormat;

/**
 * PageHeader Component
 *
 * Displays the header for individual pages, including:
 * - Page title (editable when user has permissions)
 * - Author username with subscription tier badge (via UsernameBadge component)
 * - Navigation and action buttons
 * - Privacy indicators
 *
 * USER DISPLAY FUNCTIONALITY:
 * The component uses the UsernameBadge component to handle all user display logic,
 * including username fetching, subscription data, and badge rendering.
 *
 * UsernameBadge automatically:
 * - Fetches username and subscription data based on userId
 * - Handles feature flag checks for subscription display
 * - Provides tooltips and click interactions
 * - Manages loading states and error handling
 */
export interface PageHeaderProps {
  /** The page title to display */
  title?: string;
  /** The username of the page author (fallback if userId fetch fails) */
  username?: string;
  /** The user ID of the page author (used to fetch subscription data and username) */
  userId?: string;
  /** Whether the page is currently loading */
  isLoading?: boolean;

  /** Current scroll direction for header behavior */
  scrollDirection?: string;

  /** Subscription tier (deprecated - now handled by UsernameBadge) */
  tier?: string;
  /** Subscription status (deprecated - now handled by UsernameBadge) */
  subscriptionStatus?: string;
  /** Whether the page is currently being edited */
  isEditing?: boolean;
  /** Callback to toggle edit mode - deprecated, always in edit mode */
  setIsEditing?: (value: boolean) => void;
  /** Callback when title changes during editing */
  onTitleChange?: (newTitle: string) => void;
  /** Whether the current user can edit this page */
  canEdit?: boolean;
  /** Whether there's an error with the title */
  titleError?: boolean;
  /** The page ID for navigation */
  pageId?: string | null;
  /** Flag to indicate this is a new page */
  isNewPage?: boolean;
  /** Flag to indicate this is a reply */
  isReply?: boolean;

  /** Handler for delete page */
  onDelete?: () => void;
  /** Handler for insert link */
  onInsertLink?: () => void;
}

export default function PageHeader({
  title,
  username,
  userId,
  isLoading = false,

  // scrollDirection is not used but kept for compatibility
  tier: initialTier, // deprecated - kept for compatibility
  subscriptionStatus: initialStatus, // deprecated - kept for compatibility
  isEditing = true, // ALWAYS edit mode
  setIsEditing,
  onTitleChange,
  canEdit: propCanEdit = false,
  titleError = false,
  pageId: propPageId = null,
  onOwnershipChange,
  isNewPage = false,
  isReply = false,
  onDelete,
  onInsertLink}: PageHeaderProps) {

  // Fetch subscription data for the page author
  const [authorSubscription, setAuthorSubscription] = React.useState<{
    tier?: string | null;
    status?: string | null;
    amount?: number | null;
  }>({});

  const router = useRouter();
  const { session } = useCurrentAccount();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();

  // State for scroll behavior - only used in view mode
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerPadding, setHeaderPadding] = React.useState(8);

  const { trackInteractionEvent, events } = useWeWriteAnalytics();
  const headerRef = React.useRef<HTMLDivElement>(null);
  const { lineMode, setLineMode } = useLineSettings();

  // Fetch subscription data for the page author
  React.useEffect(() => {
    if (!userId) return;

    const fetchAuthorSubscription = async () => {
      try {
        const response = await fetch(`/api/account-subscription?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setAuthorSubscription({
            tier: data.fullData?.tier || null,
            status: data.fullData?.status || null,
            amount: data.fullData?.amount || null
          });
        } else {
          setAuthorSubscription({ tier: null, status: null, amount: null });
        }
      } catch (error) {
        console.error('Error fetching author subscription:', error);
        setAuthorSubscription({ tier: null, status: null, amount: null });
      }
    };

    fetchAuthorSubscription();
  }, [userId]);

  // UsernameBadge handles all subscription data fetching internally

  const [pageId, setPageId] = React.useState<string | null>(propPageId);
  const [isAddToPageOpen, setIsAddToPageOpen] = React.useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState<boolean>(false);
  const [editingTitle, setEditingTitle] = React.useState<string>(title || "");
  const titleInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [isTitleFocused, setIsTitleFocused] = React.useState<boolean>(false);
  const [isEditorFocused, setIsEditorFocused] = React.useState<boolean>(false);

  // Date formatting context
  const { formatDate } = useDateFormat();

  // Calculate header positioning width - should match Header.tsx and SidebarLayout.tsx
  const headerSidebarWidth = React.useMemo(() => {
    // Header should only respond to persistent expanded state, not hover state
    // When expanded: always use full width (256px) regardless of hover
    // When collapsed: always use collapsed width (64px) regardless of hover
    if (isExpanded) {
      return sidebarWidth; // Use full expanded width (256px)
    } else if (sidebarWidth > 0) {
      return 64; // Use collapsed width (64px) for collapsed state
    } else {
      return 0; // No sidebar (user not authenticated)
    }
  }, [isExpanded, sidebarWidth]);

  // Daily note navigation state
  const [isNavigating, setIsNavigating] = React.useState<boolean>(false);
  const [showDateFormatPicker, setShowDateFormatPicker] = React.useState<boolean>(false);

  // Check if this is a daily note - now based on customDate field, not title format
  // After migration, daily notes have "Daily note" title and customDate field
  const isDailyNote = React.useMemo(() => {
    // Legacy check: title matches YYYY-MM-DD format (for unmigrated daily notes)
    const isLegacyDailyNote = title ? isExactDateFormat(title) : false;
    // New check: has customDate field (for migrated daily notes)
    // Note: We don't have access to customDate in PageHeader, so we'll rely on legacy check for now
    // TODO: Pass customDate as prop if needed for more accurate detection
    return isLegacyDailyNote;
  }, [title]);

  // Function to determine if the current user can edit the page
  const canEdit = React.useMemo(() => {
    // Use prop value if provided, otherwise calculate
    if (propCanEdit !== undefined) return propCanEdit;

    if (!session) return false;

    // User is the page owner
    if (userId && session.uid === userId) return true;

    return false;
  }, [propCanEdit, session, session?.uid]);

  // Update editing title when title prop changes
  React.useEffect(() => {
    setEditingTitle(title || "");
  }, [title]);

  // Auto-focus title input for new pages
  React.useEffect(() => {
    if (isNewPage && isEditing && canEdit) {
      // Start editing the title immediately for new pages
      setIsEditingTitle(true);
      // Focus the input after state update
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select(); // Select all text for immediate typing
      }, 150); // Slightly longer delay to ensure component is fully rendered
    }
  }, [isNewPage, isEditing, canEdit]);

  // Auto-resize textarea when editing title starts
  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = titleInputRef.current.scrollHeight + 'px';
    }
  }, [isEditingTitle]);

  // Listen for focus changes to coordinate focus rings
  React.useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement;

      // Check if the editor is focused
      const editorElement = document.querySelector('[contenteditable="true"]');
      const isEditorActive = editorElement && (
        activeElement === editorElement ||
        editorElement.contains(activeElement)
      );

      setIsEditorFocused(!!isEditorActive);

      // If editor is focused, title is not focused
      if (isEditorActive && isTitleFocused) {
        setIsTitleFocused(false);
      }
    };

    // Listen for focus events on the document
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, [isTitleFocused]);

  // Add/remove title-focused class to coordinate focus rings
  React.useEffect(() => {
    if (isTitleFocused) {
      document.body.classList.add('title-focused');
    } else {
      document.body.classList.remove('title-focused');
    }

    return () => {
      document.body.classList.remove('title-focused');
    };
  }, [isTitleFocused]);

  // Handle title editing
  const handleTitleClick = () => {
    // Allow title editing for all pages, including migrated daily notes
    // Only show date format picker for legacy daily notes (unmigrated ones with YYYY-MM-DD titles)
    if (isExactDateFormat(title || "") && title !== "Daily note") {
      console.log('Opening date format picker for legacy daily note:', title);
      setShowDateFormatPicker(true);
      return;
    }

    if (canEdit) {
      // Always in edit mode, just start editing the title
      setIsEditingTitle(true);
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 0);
    }
  };

  // Handle daily note navigation
  const handleDailyNoteNavigation = async (direction: 'previous' | 'next') => {
    if (!session?.uid || !title || !isExactDateFormat(title) || isNavigating) {
      return;
    }

    setIsNavigating(true);

    // Track navigation attempt
    trackInteractionEvent(events.DAILY_NOTES_NAVIGATION, {
      direction: direction,
      current_date: title,
      is_editing: isEditing,
      user_id: session.uid
    });

    try {
      const navigationResult = direction === 'previous'
        ? await navigateToPreviousDailyNote(session.uid, title, isEditing)
        : await navigateToNextDailyNote(session.uid, title, isEditing);

      if (navigationResult) {
        if (navigationResult.exists && navigationResult.pageId) {
          // Navigate to existing note
          router.push(`/pages/${navigationResult.pageId}`);
        } else if (navigationResult.shouldCreateNew) {
          // Navigate to create new note
          router.push(`/new?title=${encodeURIComponent(navigationResult.dateString)}&type=daily-note`);
        }
      } else {
        console.log(`No ${direction} daily note found`);
      }
    } catch (error) {
      console.error(`Error navigating to ${direction} daily note:`, error);
    } finally {
      setIsNavigating(false);
    }
  };

  const handleTitleSubmit = () => {
    if (editingTitle.trim() !== title && onTitleChange) {
      onTitleChange(editingTitle.trim());
    }
    setIsEditingTitle(false);
    setIsTitleFocused(false);

    // For new pages, focus the editor after title is submitted
    if (isNewPage) {
      setTimeout(() => {
        const editorElement = document.querySelector('[contenteditable="true"]');
        if (editorElement) {
          (editorElement as HTMLElement).focus();
        }
      }, 100);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditingTitle(title || "");
      setIsEditingTitle(false);
      setIsTitleFocused(false);
    }
  };

  const handleTitleBlur = () => {
    setIsTitleFocused(false);
    handleTitleSubmit();
  };

  const handleTitleFocus = () => {
    setIsTitleFocused(true);
    setIsEditorFocused(false);
    // Auto-resize textarea to fit content
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = titleInputRef.current.scrollHeight + 'px';
    }
  };

  // Auto-resize textarea when content changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingTitle(e.target.value);
    // Auto-resize textarea to fit content
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  // UsernameBadge handles all data fetching internally

  // Extract page ID from URL and determine if user can change ownership
  React.useEffect(() => {
    // Extract page ID from URL
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/');

    // The page ID is the first segment if it's not empty and not a special route
    if (pathSegments.length > 1 && pathSegments[1] &&
        ![', session', 'group', 'admin', 'search', 'new', 'settings'].includes(pathSegments[1])) {
      const extractedPageId = pathSegments[1];
      setPageId(extractedPageId);

      // Check if the current user can change ownership (is the page owner)
      if (session && userId && session.uid === userId) {
        console.log("User can change page ownership");
      }
    }
  }, [session, session?.uid]);

  // Groups functionality removed

  // No height calculation needed - header is static block element

  // No resize handling needed - header is static

  // No dynamic padding needed - always static

  React.useEffect(() => {
    // In edit mode, disable scroll handling completely
    if (isEditing) {
      setIsScrolled(false);
      setScrollProgress(0);
      setHeaderPadding(8);
      return; // No scroll listener needed
    }

    // View mode only: Use scroll handler for collapse behavior
    let lastScrollY = 0;
    let ticking = false;

    const handleScroll = () => {
      lastScrollY = window.scrollY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const shouldBeScrolled = lastScrollY > 0;
          if (shouldBeScrolled !== isScrolled) {
            setIsScrolled(shouldBeScrolled);
          }

          // Transition padding based on scroll
          const paddingTransitionDistance = 50;
          const minPadding = 4;
          const maxPadding = 8;
          const scrollRatio = Math.min(lastScrollY / paddingTransitionDistance, 1);
          const newPadding = maxPadding - (maxPadding - minPadding) * scrollRatio;
          setHeaderPadding(newPadding);

          // Calculate scroll progress
          const windowHeight = window.innerHeight;
          const mainContentElement = document.querySelector('[data-page-content]');
          let maxScroll = document.documentElement.scrollHeight - windowHeight;

          if (mainContentElement) {
            const mainContentRect = mainContentElement.getBoundingClientRect();
            const mainContentBottom = mainContentRect.bottom + window.scrollY;
            maxScroll = Math.max(0, mainContentBottom - windowHeight);
          }

          const progress = maxScroll > 0 ? (lastScrollY / maxScroll) * 100 : 0;
          setScrollProgress(Math.min(progress, 100));

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Set initial state

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isEditing, isScrolled]);

  // Create page object for handlers
  const pageObject = React.useMemo(() => {
    if (!pageId) return null;

    return {
      id: pageId,
      title: title || "Untitled",
      userId: userId,
      username: username
    };
  }, [pageId, title, session?.uid, username]);

  // Handler functions using shared utilities
  const handleAddToPageClick = () => {
    if (pageObject) {
      handleAddToPage(pageObject, setIsAddToPageOpen);
    }
  };

  const handleReplyClick = async () => {
    if (pageObject) {
      await handleReply(pageObject, session, router);
    }
  };

  const handleShareClick = () => {
    if (pageObject) {
      handleShare(pageObject, title, session);
    }
  };

  // Function to handle back button click - now goes to previous page
  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Check if we're on an activity page
    const pathname = window.location.pathname;
    if (pathname.includes('/activity')) {
      // Extract the page ID from the URL
      const pageId = pathname.split('/')[1];
      if (pageId) {
        // Navigate to the page
        router.push(`/${pageId}`);
        return;
      }
    }

    // Go to previous page in browser history
    // Users can always reach home via the WeWrite logo
    try {
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
      // Fallback to browser history if router.back() fails
      window.history.back();
    }
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`
          ${isEditing ? 'block' : 'fixed top-0 left-0 right-0 w-full'}
          z-50 bg-background border-visible
          ${!isEditing ? 'transition-all duration-300 ease-out will-change-transform' : ''}
          ${isScrolled && !isEditing ? 'bg-background/80 backdrop-blur-sm shadow-sm' : ''}
        `}
        style={!isEditing ? { transform: 'translateZ(0)' } : {}}
      >
        {/* Use the same layout approach as Header.tsx for consistent spacing */}
        <div className="flex w-full h-full">
          {/* Sidebar spacer - only on desktop, matches Header.tsx logic */}
          <div
            className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
            style={{ width: `${headerSidebarWidth}px` }}
          />

          {/* Header content area - matches main header content area */}
          <div className="flex-1 min-w-0 relative px-4 header-padding-mobile">
            {/* Collapsed Header Layout - Single Row */}
            {isScrolled && !isEditing && (
              <div
                className="flex items-center justify-center min-h-0 transition-all duration-300 ease-out relative"
                style={{
                  paddingTop: `${headerPadding}px`,
                  paddingBottom: `${headerPadding}px`,
                  transform: 'translateZ(0)', // Force GPU acceleration
                  willChange: 'padding'
                }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                {/* Center: Logo + Title and Byline compound element */}
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                  {/* Logo to the left of text - clickable to go home */}
                  <Logo size="sm" priority={true} styled={true} clickable={true} />

                  {/* Title and Byline */}
                  <div className="flex items-center gap-1 min-w-0">
                    <h1 className="text-xs font-semibold opacity-90 truncate">
                      {isLoading ? (
                        <span className="inline-flex items-center">
                          <Loader className="h-3 w-3 animate-spin mr-1" />
                          Loading...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="truncate">
                            {isDailyNote && title
                              ? formatDate(title)
                              : title
                              ? title
                              : isNewPage
                              ? (isReply ? "Give your reply a title..." : "Give your page a title...")
                              : "Untitled"
                            }
                          </span>

                        </span>
                      )}
                    </h1>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      by <UsernameBadge
                        userId={userId}
                        username={username}
                        tier={authorSubscription.tier}
                        subscriptionStatus={authorSubscription.status}
                        subscriptionAmount={authorSubscription.amount}
                        size="sm"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Expanded Header Layout - Always show when editing, or when not scrolled in view mode */}
            {(!isScrolled || isEditing) && (
              <div
                className="space-y-2 transition-all duration-300 ease-out"
                style={{
                  paddingTop: `${headerPadding}px`,
                  paddingBottom: `${headerPadding}px`,
                  transform: 'translateZ(0)', // Force GPU acceleration
                  willChange: 'padding'
                }}
              >
                {/* Row 1: Back Button + Logo + Menu */}
                <div className="flex items-center justify-between">
                  {/* Left: Back Button */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-foreground"
                      onClick={handleBackClick}
                      title="Go back"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Center: Logo - clickable to go home */}
                  <div className="flex items-center cursor-pointer" onClick={() => router.push('/')}>
                    <Logo size="lg" priority={true} styled={true} clickable={true} />
                  </div>

                  {/* Right: Menu */}
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-foreground"
                          title="Page actions"
                          tabIndex={isNewPage ? 3 : undefined}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {/* Menu items for existing pages */}
                        {!isNewPage && (
                          <>
                            {/* Edit option removed - pages are now always editable */}

                            {/* Owner options - always available for editable pages */}
                            {canEdit && (
                              <>
                                {/* Insert Link option - available for page owners */}
                                {onInsertLink && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={onInsertLink}
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    <span>Insert link</span>
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            {/* General options - available to all users */}
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={handleShareClick}
                            >
                              <Share2 className="h-4 w-4" />
                              <span>Share</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="gap-2"
                              onClick={handleAddToPageClick}
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add to Page</span>
                                </DropdownMenuItem>

                                {/* Reply option - only visible when not in edit mode */}
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={handleReplyClick}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  <span>Reply</span>
                                </DropdownMenuItem>

                                {/* Only show separator and paragraph mode for read-only pages */}
                                {!canEdit && (
                                  <>
                                    <DropdownMenuSeparator />

                                    {/* Paragraph Mode submenu - only visible when user can't edit (read-only mode) */}
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger className="gap-2">
                                        {lineMode === LINE_MODES.DENSE ? (
                                          <AlignJustify className="h-4 w-4" />
                                        ) : (
                                          <AlignLeft className="h-4 w-4" />
                                        )}
                                        <span>Paragraph Mode</span>
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                          <DropdownMenuItem
                                            className={`gap-2 ${lineMode === LINE_MODES.NORMAL ? 'bg-accent/50' : ''}`}
                                            onClick={() => setLineMode(LINE_MODES.NORMAL)}
                                          >
                                            <AlignLeft className="h-4 w-4" />
                                            <span>Normal</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className={`gap-2 ${lineMode === LINE_MODES.DENSE ? 'bg-accent/50' : ''}`}
                                            onClick={() => setLineMode(LINE_MODES.DENSE)}
                                          >
                                            <AlignJustify className="h-4 w-4" />
                                            <span>Dense</span>
                                          </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                  </>
                                )}

                                {/* Delete button - moved to bottom for edit mode */}
                                {canEdit && onDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={onDelete}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>Delete page</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Row 2: Title */}
                <div className="flex items-center justify-center">
                  {/* Left navigation chevron for daily notes */}
                  {isDailyNote && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 mr-2 transition-opacity duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDailyNoteNavigation('previous');
                      }}
                      disabled={isNavigating}
                      title={isEditing ? "Previous calendar day (creates new note)" : "Previous daily note (existing notes only)"}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="flex-1 text-center">
                    <h1 className="text-2xl font-semibold">
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <Loader className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading title...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          {isEditing && canEdit && isEditingTitle && !(isExactDateFormat(title || "") && title !== "Daily note") ? (
                            <textarea
                              ref={titleInputRef}
                              value={editingTitle}
                              onChange={handleTitleChange}
                              onKeyDown={handleTitleKeyDown}
                              onBlur={handleTitleBlur}
                              onFocus={handleTitleFocus}
                              tabIndex={isNewPage ? 1 : undefined}
                              className={`bg-background/80 border rounded-lg px-1 py-0.5 outline-none font-semibold text-center transition-all duration-200 resize-none overflow-hidden ${
                                titleError
                                  ? "border-destructive focus:ring-2 focus:ring-destructive/20 focus:border-destructive"
                                  : isTitleFocused
                                  ? "border-primary/50 ring-2 ring-primary/20"
                                  : "border-muted-foreground/30"
                              } text-2xl`}
                              style={{
                                width: "100%",
                                minHeight: "2.5rem",
                                lineHeight: "1.3"
                              }}
                              placeholder={isNewPage ? (isReply ? "Give your reply a title..." : "Give your page a title...") : "Add a title..."}
                              rows={1}
                            />
                          ) : (
                            <span
                              className={`${
                                canEdit && !isDailyNote
                                  ? isEditing
                                    ? `cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 border transition-all duration-200 ${
                                        titleError
                                          ? "border-destructive hover:border-destructive/70"
                                          : isEditorFocused
                                          ? "border-muted-foreground/30"
                                          : "border-muted-foreground/20 hover:border-muted-foreground/30"
                                      }`
                                    : "cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 transition-all duration-200"
                                  : isDailyNote
                                  ? isEditing
                                    ? "flex flex-col items-center gap-1 cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 border border-muted-foreground/20 hover:border-muted-foreground/30 transition-all duration-200"
                                    : "flex flex-col items-center gap-1 cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 transition-all duration-200"
                                  : isDailyNote
                                  ? "cursor-pointer"
                                  : ""
                              }`}
                              style={{
                                width: '100%',
                                display: 'block',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                hyphens: 'none'
                              }}
                              onClick={handleTitleClick}
                              title={
                                (isExactDateFormat(title || "") && title !== "Daily note")
                                  ? "Click to change date format"
                                  : (canEdit ? (isEditing ? "Click to edit title" : "Click to edit page") : undefined)
                              }
                            >
                              <span className={!title && (isNewPage || isReply) ? "text-muted-foreground" : ""}>
                                {(isExactDateFormat(title || "") && title !== "Daily note") && title
                                  ? formatDate(title)
                                  : title
                                  ? title
                                  : isNewPage
                                  ? (isReply ? "Give your reply a title..." : "Give your page a title...")
                                  : "Untitled"
                                }
                              </span>
                            </span>
                          )}

                        </div>
                      )}
                    </h1>
                  </div>

                  {/* Right navigation chevron for daily notes */}
                  {isDailyNote && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 ml-2 transition-opacity duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDailyNoteNavigation('next');
                      }}
                      disabled={isNavigating}
                      title={isEditing ? "Next calendar day (creates new note)" : "Next daily note (existing notes only)"}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Title Error Message */}
                {titleError && isEditing && canEdit && !isDailyNote && (
                  <div className="flex justify-center mt-2">
                    <p className="text-sm text-destructive font-medium">
                      Title is required
                    </p>
                  </div>
                )}

                {/* Row 3: Byline */}
                <div className="flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? (
                      <span className="inline-flex items-center">
                        <Loader className="h-3 w-3 animate-spin mr-1" />
                        Loading...
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 justify-center">
                        <span className="whitespace-nowrap flex-shrink-0">by</span>
                        <UsernameBadge
                          userId={userId}
                          username={username}
                          tier={authorSubscription.tier}
                          subscriptionStatus={authorSubscription.status}
                          subscriptionAmount={authorSubscription.amount}
                          size="sm"
                          className="text-xs overflow-hidden text-ellipsis"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll Progress Bar - positioned outside padded container */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-out"
          style={{
            width: `${scrollProgress}%`,
            transform: 'translateZ(0)', // Force GPU acceleration
            willChange: 'width'
          }}
        />
      </header>

      {/* Add to Page Modal - shared with bottom button functionality */}
      {pageObject && (
        <AddToPageButton
          page={pageObject}
          isOpen={isAddToPageOpen}
          setIsOpen={setIsAddToPageOpen}
          hideButton={true}
        />
      )}

      {/* Date Format Picker for Daily Notes - only show when explicitly opened */}
      {isDailyNote && showDateFormatPicker && (
        <DateFormatPicker
          currentDate={title || undefined}
          isOpen={showDateFormatPicker}
          onClose={() => setShowDateFormatPicker(false)}
        />
      )}
    </>
  );
}