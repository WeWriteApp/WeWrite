"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Loader, ChevronLeft, ChevronRight, Share2, Lock, Globe, MoreHorizontal, Edit2, Plus, MessageSquare, Trash2, Link as LinkIcon, AlignJustify, AlignLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ref, get } from "firebase/database";
import { rtdb } from "../../firebase/rtdb";
import dynamic from 'next/dynamic';

import { getUsernameById, getUserSubscriptionTier } from "../../utils/userUtils";
import { SupporterIcon } from "../payments/SupporterIcon";
import { SubscriptionInfoModal } from "../payments/SubscriptionInfoModal";

import ClickableByline from "../utils/ClickableByline";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useDateFormat } from '../../contexts/DateFormatContext';
import { handleAddToPage, handleReply, handleShare } from "../../utils/pageActionHandlers";
import { useFeatureFlag } from "../../utils/feature-flags";
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

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
  scrollDirection?: string;
  isPrivate?: boolean;
  tier?: string;
  subscriptionStatus?: string;
  isEditing?: boolean;
  setIsEditing?: (value: boolean) => void;
  onTitleChange?: (newTitle: string) => void;
  canEdit?: boolean;
  titleError?: boolean;
  pageId?: string | null;
  isNewPage?: boolean; // Add flag to indicate this is a new page
  onPrivacyChange?: (isPublic: boolean) => void; // Add handler for privacy toggle
  onDelete?: () => void; // Add handler for delete page
  onInsertLink?: () => void; // Add handler for insert link
}

export default function PageHeader({
  title,
  username,
  userId,
  isLoading = false,
  // scrollDirection is not used but kept for compatibility
  isPrivate = false,
  tier: initialTier,
  subscriptionStatus: initialStatus,
  isEditing = false,
  setIsEditing,
  onTitleChange,
  canEdit: propCanEdit = false,
  titleError = false,
  pageId: propPageId = null,
  onOwnershipChange,
  isNewPage = false,
  onPrivacyChange,
  onDelete,
  onInsertLink}: PageHeaderProps) {
  const router = useRouter();
  const { session } = useCurrentAccount();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const [headerPadding, setHeaderPadding] = React.useState(8); // Start at 8px (py-2)
  const { trackInteractionEvent, events } = useWeWriteAnalytics();
  const headerRef = React.useRef<HTMLDivElement>(null);
  const { lineMode, setLineMode } = useLineSettings();
  const [displayUsername, setDisplayUsername] = React.useState<string>(username || "Anonymous");
  const [tier, setTier] = React.useState<string | null>(initialTier || null);
  const [subscriptionStatus, setSubscriptionStatus] = React.useState<string | null>(initialStatus || null);
  const [isLoadingTier, setIsLoadingTier] = React.useState<boolean>(false);
  const subscriptionEnabled = useFeatureFlag('payments', session?.email);
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

  // Check if this is a daily note
  const isDailyNote = React.useMemo(() => {
    return title ? isExactDateFormat(title) : false;
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
    // For daily notes, open date format picker instead of editing title
    if (isExactDateFormat(title || "")) {
      console.log('Opening date format picker for daily note:', title);
      setShowDateFormatPicker(true);
      return;
    }

    if (canEdit) {
      if (!isEditing && setIsEditing) {
        // If not in edit mode, trigger edit mode first
        setIsEditing(true);
      } else if (isEditing) {
        // If already in edit mode, start editing the title
        setIsEditingTitle(true);
        // Focus the input after state update
        setTimeout(() => {
          titleInputRef.current?.focus();
          titleInputRef.current?.select();
        }, 0);
      }
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

  // Fetch username if not provided but userId is available
  React.useEffect(() => {
    const fetchTierInfo = async () => {
      if (userId) {
        try {
          setIsLoadingTier(true);
          const { tier: fetchedTier, status } = await getUserSubscriptionTier(userId);
          setTier(fetchedTier);
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Error fetching tier info:', error);
        } finally {
          setIsLoadingTier(false);
        }
      }
    };

    fetchTierInfo();
  }, [session?.uid]);

  // Fetch username if not provided but userId is available
  React.useEffect(() => {
    const fetchUsername = async () => {
      // Always set a default username first
      setDisplayUsername(username || "Missing username");

      // Then try to fetch the actual username if we have a userId
      if (userId) {
        try {
          console.log("Fetching username for userId:", userId);
          const fetchedUsername = await getUsernameById(userId);
          if (fetchedUsername && fetchedUsername !== "Anonymous" && fetchedUsername !== "Missing username") {
            setDisplayUsername(fetchedUsername);
            console.log("Username fetched for PageHeader:", fetchedUsername);
          }
        } catch (error) {
          console.error("Error fetching username for header:", error);
          // Keep the default username on error
        }
      }
    };

    fetchUsername();
  }, [userId, session?.username]);

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

  // Calculate and update header height when component mounts or when title/isScrolled changes
  React.useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        // Use actual measured height instead of calculated height
        // This accounts for dynamic title wrapping and content changes
        const actualHeight = headerRef.current.offsetHeight;
        const clientHeight = headerRef.current.clientHeight;
        const scrollHeight = headerRef.current.scrollHeight;
        const computedStyle = window.getComputedStyle(headerRef.current);
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;

        // Calculate the content height without borders
        const contentHeight = actualHeight - borderTop - borderBottom;

        setHeaderHeight(actualHeight);

        // Debug logging to track height calculations (can be removed in production)
        if (process.env.NODE_ENV === 'development') {
          console.log('PageHeader height update:', {
            actualHeight,
            contentHeight,
            adjustedHeight: Math.max(contentHeight - 4, actualHeight * 0.95),
            isScrolled,
            headerPadding,
            title: title?.substring(0, 30) + (title && title.length > 30 ? '...' : '')
          });
        }

        // Use a slightly reduced height to account for any extra spacing
        // This prevents excessive padding while still providing enough clearance
        const adjustedHeight = Math.max(contentHeight - 4, actualHeight * 0.95);
        document.documentElement.style.setProperty('--page-header-height', `${adjustedHeight}px`);
      }
    };

    // Initial update with a small delay to ensure rendering is complete
    const timeoutId = setTimeout(updateHeaderHeight, 50);

    // Add resize listener to recalculate on window resize
    window.addEventListener('resize', updateHeaderHeight);

    // Use ResizeObserver for more accurate height tracking with debouncing
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeout: NodeJS.Timeout | null = null;

    if (headerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        // Debounce the resize updates to prevent excessive recalculations
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateHeaderHeight, 16); // ~60fps
      });
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener('resize', updateHeaderHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [title, isScrolled, headerPadding, isEditingTitle]);

  React.useEffect(() => {
    // Use a throttled scroll handler for better performance
    let lastScrollY = 0;
    let ticking = false;

    const handleScroll = () => {
      lastScrollY = window.scrollY;

      // Use requestAnimationFrame for smoother performance
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Update scroll state - only change if needed
          const shouldBeScrolled = lastScrollY > 0;
          if (shouldBeScrolled !== isScrolled) {
            setIsScrolled(shouldBeScrolled);
          }

          // Calculate smooth header padding transition
          // Transition from 8px to 4px over 50px of scroll
          const paddingTransitionDistance = 50;
          const minPadding = 4; // py-1
          const maxPadding = 8; // py-2
          const scrollRatio = Math.min(lastScrollY / paddingTransitionDistance, 1);
          const newPadding = maxPadding - (maxPadding - minPadding) * scrollRatio;
          setHeaderPadding(newPadding);

          // Calculate scroll progress based on main content area only
          const windowHeight = window.innerHeight;

          // Find the main content area (exclude footer sections)
          const mainContentElement = document.querySelector('[data-page-content]');
          let maxScroll = document.documentElement.scrollHeight - windowHeight;

          if (mainContentElement) {
            // Calculate the height up to the end of main content
            const mainContentRect = mainContentElement.getBoundingClientRect();
            const mainContentBottom = mainContentRect.bottom + window.scrollY;

            // Use the main content bottom as the effective scroll height
            maxScroll = Math.max(0, mainContentBottom - windowHeight);
          }

          const progress = maxScroll > 0 ? (lastScrollY / maxScroll) * 100 : 0;
          setScrollProgress(Math.min(progress, 100));

          ticking = false;
        });

        ticking = true;
      }
    };

    // Use passive event listener for better performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also add scrollend event listener for modern browsers
    const handleScrollEnd = () => {
      // When scrolling stops, check if we're at the top
      if (window.scrollY < 5) {
        // Force scroll to absolute top to avoid partial header overlay
        window.scrollTo({top: 0, behavior: 'instant'});
      }
    };

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', handleScrollEnd);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', handleScrollEnd);
      }
    };
  }, [isScrolled]);

  // Create page object for handlers
  const pageObject = React.useMemo(() => {
    if (!pageId) return null;

    return {
      id: pageId,
      title: title || "Untitled",
      userId: userId,
      username: displayUsername
    };
  }, [pageId, title, session?.uid, displayUsername]);

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

  // Function to handle back button click
  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Check if we're on a history page
    const pathname = window.location.pathname;
    if (pathname.includes('/history')) {
      // Extract the page ID from the URL
      const pageId = pathname.split('/')[1];
      if (pageId) {
        // Navigate to the page
        router.push(`/${pageId}`);
        return;
      }
    }

    // Check if we came from a user page or home
    if (document.referrer.includes('/user/')) {
      // Extract user ID from referrer and navigate to that user's page
      const referrer = new URL(document.referrer);
      const userPath = referrer.pathname.split('/');
      if (userPath.length >= 3) {
        const userId = userPath[2];
        router.push(`/user/${userId}`);
        return;
      }
    }

    // Default to home page
    router.push('/');
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 z-50 transition-all duration-300 ease-out will-change-transform header-border-transition ${
          isScrolled
            ? "bg-background/80 backdrop-blur-sm shadow-sm"
            : "bg-background border-visible"
        }`}
        style={{
          transform: 'translateZ(0)', // Force GPU acceleration
          left: '0px',
          right: '0px',
          width: '100%'
        }}
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
            {isScrolled && (
              <div
                className="flex items-center justify-between min-h-0 transition-all duration-300 ease-out"
                style={{
                  paddingTop: `${headerPadding}px`,
                  paddingBottom: `${headerPadding}px`,
                  transform: 'translateZ(0)', // Force GPU acceleration
                  willChange: 'padding'
                }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                {/* Left: Logo */}
                <div className="flex items-center gap-2 mr-3">
                  <Logo size="sm" priority={true} />
                </div>

                {/* Center: Title and Byline */}
                <div className="flex-1 flex items-center justify-center gap-1 min-w-0 cursor-pointer">
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
                            ? "Give your page a title..."
                            : "Untitled"
                          }
                        </span>
                        {isPrivate && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                      </span>
                    )}
                  </h1>
                  <span className="text-xs text-muted-foreground">by {displayUsername}</span>
                </div>

                {/* Right: Empty space for symmetry */}
                <div className="w-8"></div>
              </div>
            )}

            {/* Expanded Header Layout - Three Rows */}
            {!isScrolled && (
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

                  {/* Center: Logo */}
                  <div className="flex items-center">
                    <Logo size="lg" priority={true} />
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
                        {/* For new pages, show only the privacy toggle */}
                        {isNewPage ? (
                          <DropdownMenuItem
                            className="flex items-center justify-between cursor-pointer py-3"
                            onClick={(e) => {
                              e.preventDefault();
                              if (onPrivacyChange) {
                                onPrivacyChange(!isPrivate);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {!isPrivate ? (
                                <Globe className="h-4 w-4 text-green-500" />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="flex flex-col">
                                <span className="font-medium">{!isPrivate ? "Public" : "Private"}</span>
                                <span className="text-xs text-muted-foreground">
                                  {!isPrivate ? "Anyone can view this page" : "Only you can view this page"}
                                </span>
                              </div>
                            </div>
                            <Switch
                              checked={!isPrivate}
                              onCheckedChange={(checked) => {
                                if (onPrivacyChange) {
                                  onPrivacyChange(checked);
                                }
                              }}
                              aria-label="Toggle page visibility"
                            />
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {/* Edit option - only visible if user can edit */}
                            {canEdit && setIsEditing && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => {
                                  setIsEditing(!isEditing);
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                                <span>{isEditing ? "Cancel" : "Edit"}</span>
                              </DropdownMenuItem>
                            )}

                            {/* Edit mode specific options */}
                            {isEditing ? (
                              <>
                                {/* Insert Link option - only in edit mode */}
                                {onInsertLink && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={onInsertLink}
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    <span>Insert link</span>
                                  </DropdownMenuItem>
                                )}

                                {/* Delete page option - only in edit mode and if user can edit */}
                                {canEdit && onDelete && (
                                  <DropdownMenuItem
                                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={onDelete}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Delete page</span>
                                  </DropdownMenuItem>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Share option - only visible when not in edit mode */}
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={handleShareClick}
                                >
                                  <Share2 className="h-4 w-4" />
                                  <span>Share</span>
                                </DropdownMenuItem>

                                {/* Add to Page option - only visible when not in edit mode */}
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

                                <DropdownMenuSeparator />

                                {/* Paragraph Mode submenu - only visible when not in edit mode */}
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
                        <div className={`flex items-center justify-center ${isPrivate ? 'gap-1.5' : ''}`}>
                          {isEditing && canEdit && isEditingTitle && !isDailyNote ? (
                            <textarea
                              ref={titleInputRef}
                              value={editingTitle}
                              onChange={handleTitleChange}
                              onKeyDown={handleTitleKeyDown}
                              onBlur={handleTitleBlur}
                              onFocus={handleTitleFocus}
                              tabIndex={isNewPage ? 1 : undefined}
                              className={`bg-background/80 border rounded-lg px-2 py-1 outline-none font-semibold text-center transition-all duration-200 resize-none overflow-hidden ${
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
                              placeholder={isNewPage ? "Give your page a title..." : "Add a title..."}
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
                                isDailyNote
                                  ? "Click to change date format"
                                  : (canEdit ? (isEditing ? "Click to edit title" : "Click to edit page") : undefined)
                              }
                            >
                              <span className={!title && isNewPage ? "text-muted-foreground" : ""}>
                                {isDailyNote && title
                                  ? formatDate(title)
                                  : title
                                  ? title
                                  : isNewPage
                                  ? "Give your page a title..."
                                  : "Untitled"
                                }
                              </span>
                            </span>
                          )}
                          {isPrivate && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
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

                {/* Row 3: Byline */}
                <div className="flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? (
                      <span className="inline-flex items-center">
                        <Loader className="h-3 w-3 animate-spin mr-1" />
                        Loading...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 justify-center">
                        <span className="whitespace-nowrap flex-shrink-0">by</span>
                        {isNewPage ? (
                          <span className="overflow-hidden text-ellipsis">
                            {isLoading || !displayUsername ? (
                              <span className="inline-flex items-center text-muted-foreground">
                                <Loader className="h-3 w-3 animate-spin mr-1" />
                                Loading...
                              </span>
                            ) : (
                              <span data-component-name="PageHeader" className="overflow-hidden text-ellipsis">
                                {displayUsername}
                              </span>
                            )}
                          </span>
                        ) : (
                          <Link href={`/user/${userId}`} className="hover:underline overflow-hidden text-ellipsis">
                            {isLoading || !displayUsername ? (
                              <span className="inline-flex items-center text-muted-foreground">
                                <Loader className="h-3 w-3 animate-spin mr-1" />
                                Loading...
                              </span>
                            ) : (
                              <span data-component-name="PageHeader" className="overflow-hidden text-ellipsis">
                                {displayUsername}
                              </span>
                            )}
                          </Link>
                        )}
                        {subscriptionEnabled && (
                          <SubscriptionInfoModal currentTier={tier} currentStatus={subscriptionStatus} userId={userId} username={displayUsername && displayUsername !== 'Anonymous' ? displayUsername : undefined}>
                            <div className="cursor-pointer flex-shrink-0 flex items-center">
                              <SupporterIcon tier={tier} status={subscriptionStatus} size="sm" />
                            </div>
                          </SubscriptionInfoModal>
                        )}
                      </span>
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