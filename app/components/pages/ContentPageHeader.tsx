"use client";

import * as React from "react";
import { Icon } from '@/components/ui/Icon';
import Link from "next/link";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
// REMOVED: Direct Firebase RTDB imports - now using API endpoints
import { rtdbApi } from "../../utils/apiClient";
import dynamic from 'next/dynamic';

import { UsernameBadge } from "../ui/UsernameBadge";
import { Textarea } from "../ui/textarea";

import ClickableByline from "../utils/ClickableByline";
import { useAuth } from '../../providers/AuthProvider';
import { useDateFormat } from '../../contexts/DateFormatContext';
import { useBanner } from '../../providers/BannerProvider';
import { handleAddToPage, handleReply, handleShare } from "../../utils/pageActionHandlers";

import { useSidebarContext } from "../layout/DesktopSidebar";
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

// Dynamically import TitleSettingsModal to avoid SSR issues
const TitleSettingsModal = dynamic(() => import('./TitleSettingsModal'), {
  ssr: false,
  loading: () => null
});

import AddToPageButton from '../utils/AddToPageButton';

/**
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 * @deprecated Use isDailyNoteFormat from dailyNoteNavigation utils instead
 */
const isExactDateFormat = isDailyNoteFormat;

/**
 * ContentPageHeader Component (ContentPageHeader.tsx)
 *
 * Displays the header for individual ContentPages, including:
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
export interface ContentPageHeaderProps {
  /** The page title to display */
  title?: string;
  /** Alternative titles for the page (aliases for search) */
  alternativeTitles?: string[];
  /** The username of the page author (fallback if userId fetch fails) */
  username?: string;
  /** Explicit author username if available */
  authorUsername?: string;
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
  /** Callback when alternative titles change */
  onAlternativeTitlesChange?: (titles: string[]) => void;

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
  /** Flag to indicate the title was pre-filled from a link creation */
  titlePreFilled?: boolean;

  /** Handler for delete page */
  onDelete?: () => void;
  /** Handler for insert link */
  onInsertLink?: () => void;
  /** Optional back handler override (used by /new to animate exit) */
  onBack?: () => void;
}

export default function ContentPageHeader({
  title,
  alternativeTitles = [],
  username,
  authorUsername,
  userId,
  isLoading = false,

  // scrollDirection is not used but kept for compatibility
  tier: initialTier, // deprecated - kept for compatibility
  subscriptionStatus: initialStatus, // deprecated - kept for compatibility
  isEditing = false, // Default to view mode - will be overridden by parent component
  setIsEditing,
  onTitleChange,
  onAlternativeTitlesChange,

  canEdit: propCanEdit = false,
  titleError = false,
  pageId: propPageId = null,
  onOwnershipChange,
  isNewPage = false,
  isReply = false,
  titlePreFilled = false,
  onDelete,
  onInsertLink,
  onBack
}: ContentPageHeaderProps) {

  // Fetch subscription data for the page author
  const [authorSubscription, setAuthorSubscription] = React.useState<{
    tier?: string | null;
    status?: string | null;
    amount?: number | null;
  }>({});

  const router = useRouter();
  const { user } = useAuth();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const { bannerOffset } = useBanner();

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
  const [isTitleSettingsOpen, setIsTitleSettingsOpen] = React.useState<boolean>(false);
  const [localAlternativeTitles, setLocalAlternativeTitles] = React.useState<string[]>(alternativeTitles);



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

    if (!user) return false;

    // User is the page owner
    if (userId && user.uid === userId) return true;

    return false;
  }, [propCanEdit, user, user?.uid]);

  // Update editing title when title prop changes
  React.useEffect(() => {
    setEditingTitle(title || "");
  }, [title]);

  // Update alternative titles when prop changes (using JSON comparison to avoid infinite loops)
  const alternativeTitlesJson = JSON.stringify(alternativeTitles);
  React.useEffect(() => {
    setLocalAlternativeTitles(alternativeTitles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alternativeTitlesJson]);

  // Auto-focus title input for new pages (unless title was pre-filled from link creation)
  React.useEffect(() => {
    if (isNewPage && isEditing && canEdit) {
      if (titlePreFilled) {
        // Title was pre-filled from link creation, focus the editor instead
        setTimeout(() => {
          const editorElement = document.querySelector('[contenteditable="true"]');
          if (editorElement) {
            (editorElement as HTMLElement).focus();
          }
        }, 150);
      } else {
        // Start editing the title immediately for new pages
        setIsEditingTitle(true);
        // Focus the input after state update
        setTimeout(() => {
          titleInputRef.current?.focus();
          titleInputRef.current?.select(); // Select all text for immediate typing
        }, 150); // Slightly longer delay to ensure component is fully rendered
      }
    }
  }, [isNewPage, isEditing, canEdit, titlePreFilled]);

  // Title character limits
  const TITLE_WARNING_LENGTH = 50;
  const TITLE_MAX_LENGTH = 80;

  // Helper to resize title field textarea
  const resizeTitleField = React.useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const minHeight = 64; // match design height

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      // Temporarily set height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';
      textarea.style.minHeight = `${minHeight}px`;

      // Get the scroll height (actual content height)
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.max(scrollHeight, minHeight);

      // Set the new height
      textarea.style.height = `${newHeight}px`;
    });
  }, []);

  // Auto-resize textarea when editing title starts or content changes
  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      resizeTitleField(titleInputRef.current);
    }
  }, [isEditingTitle, editingTitle, resizeTitleField]); // Also trigger when editingTitle content changes

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
    if (!user?.uid || !title || !isExactDateFormat(title) || isNavigating) {
      return;
    }

    setIsNavigating(true);

    // Track navigation attempt
    trackInteractionEvent(events.DAILY_NOTES_NAVIGATION, {
      direction: direction,
      current_date: title,
      is_editing: isEditing,
      user_id: user.uid
    });

    try {
      const navigationResult = direction === 'previous'
        ? await navigateToPreviousDailyNote(user.uid, title, isEditing)
        : await navigateToNextDailyNote(user.uid, title, isEditing);

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
    resizeTitleField(titleInputRef.current);
  };



  // Auto-resize textarea when content changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newTitle = e.target.value;

    // Enforce hard limit at 80 characters
    if (newTitle.length > TITLE_MAX_LENGTH) {
      newTitle = newTitle.slice(0, TITLE_MAX_LENGTH);
    }

    setEditingTitle(newTitle);
    resizeTitleField(e.target);

    // Also call the parent's onTitleChange for real-time updates
    if (onTitleChange) {
      onTitleChange(newTitle);
    }
  };

  // UsernameBadge handles all data fetching internally

  // Extract page ID from URL and determine if user can change ownership
  React.useEffect(() => {
    // Extract page ID from URL
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/');

    // The page ID is the first segment if it's not empty and not a special route
    if (pathSegments.length > 1 && pathSegments[1] &&
        ![', user', 'group', 'admin', 'search', 'new', 'settings'].includes(pathSegments[1])) {
      const extractedPageId = pathSegments[1];
      setPageId(extractedPageId);

      // Check if the current user can change ownership (is the page owner)
      // User can change page ownership if they own it
    }
  }, [user, user?.uid]);

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

    // Calculate collapse threshold - use CSS variable value or fallback
    const getBannerStackHeight = () => {
      if (typeof window === 'undefined') return 0;
      const value = getComputedStyle(document.documentElement).getPropertyValue('--banner-stack-height');
      return parseInt(value) || 0;
    };
    const collapseThreshold = Math.max(48, getBannerStackHeight() + 8);
    const hysteresis = 12; // Prevent rapid flip/flop near threshold
    let ticking = false;

    // Get scroll position using multiple fallback methods for maximum compatibility
    const getScrollPosition = (): number => {
      // Try all possible scroll position sources
      const sources = [
        window.scrollY,
        window.pageYOffset,
        document.documentElement?.scrollTop,
        document.body?.scrollTop,
        // For iOS Safari PWA mode
        document.scrollingElement?.scrollTop
      ];
      
      // Return the first valid (non-zero, non-undefined) value, or max of all
      const validSources = sources.filter(s => typeof s === 'number' && !isNaN(s));
      return Math.max(0, ...validSources);
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        const currentScroll = getScrollPosition();

        // Collapse purely based on scroll position with hysteresis so we do not get stuck
        setIsScrolled((prev) => {
          if (currentScroll > collapseThreshold) return true;
          if (currentScroll < Math.max(0, collapseThreshold - hysteresis)) return false;
          return prev;
        });

        // Transition padding based on scroll
        const paddingTransitionDistance = 50;
        const minPadding = 4;
        const maxPadding = 8;
        const scrollRatio = Math.min(currentScroll / paddingTransitionDistance, 1);
        const newPadding = maxPadding - (maxPadding - minPadding) * scrollRatio;
        setHeaderPadding(newPadding);

        // Calculate scroll progress
        const windowHeight = window.innerHeight;
        const mainContentElement = document.querySelector('[data-page-content]');
        let maxScroll = document.documentElement.scrollHeight - windowHeight;

        if (mainContentElement) {
          const mainContentRect = mainContentElement.getBoundingClientRect();
          const mainContentBottom = mainContentRect.bottom + currentScroll;
          maxScroll = Math.max(0, mainContentBottom - windowHeight);
        }

        const progress = maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 0;
        setScrollProgress(Math.min(progress, 100));

        ticking = false;
      });
    };

    // Create a touch-based scroll detection for iOS
    let lastTouchY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      // Trigger scroll handler on touch move as backup
      handleScroll();
    };

    // Attach listeners to multiple targets for maximum compatibility
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true });
    
    // iOS Safari often needs touch events as scroll backup
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    
    // Also listen on the scrolling element directly
    const scrollingElement = document.scrollingElement || document.documentElement;
    if (scrollingElement && scrollingElement !== document.documentElement) {
      scrollingElement.addEventListener("scroll", handleScroll, { passive: true });
    }

    // Set initial state
    handleScroll();
    
    // Also check periodically for scroll position (catches edge cases)
    const intervalId = setInterval(handleScroll, 250);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      if (scrollingElement && scrollingElement !== document.documentElement) {
        scrollingElement.removeEventListener("scroll", handleScroll);
      }
      clearInterval(intervalId);
    };
  }, [isEditing]);

  // Create page object for handlers
  const pageObject = React.useMemo(() => {
    if (!pageId) return null;

    return {
      id: pageId,
      title: title || "Untitled",
      userId: userId,
      username: username,
      authorUsername: authorUsername || username
    };
  }, [pageId, title, user?.uid, username, authorUsername]);

  // Handler functions using shared utilities
  const handleAddToPageClick = () => {
    if (pageObject) {
      handleAddToPage(pageObject, setIsAddToPageOpen);
    }
  };

  const handleReplyClick = async () => {
    if (pageObject) {
      await handleReply(pageObject, user, router);
    }
  };

  const handleShareClick = () => {
    if (pageObject) {
      handleShare(pageObject, title, user);
    }
  };

  // Function to handle back button click - now goes to previous page
  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (onBack) {
      onBack();
      return;
    }

    // Check if we're on a versions page (formerly activity page)
    const pathname = window.location.pathname;
    if (pathname.includes('/versions') || pathname.includes('/activity')) {
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

  // Logo/home click handler - for new pages, use onBack for slide-down dismiss
  const handleLogoClick = () => {
    if (isScrolled && !isEditing) {
      // When scrolled in view mode, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (isNewPage && onBack) {
      // For new pages, use onBack to trigger slide-down dismiss
      onBack();
    } else {
      // Default: go to home
      router.push('/');
    }
  };

  return (
    <>
      <header
        ref={headerRef}
        data-component="main-header"
        className={`
          ${isEditing ? 'block page-header-edit-mode w-full' : 'fixed top-0 left-0 right-0 w-full'}
          z-50 bg-background border-visible
          ${!isEditing ? 'transition-all duration-300 ease-out will-change-transform' : ''}
          ${isScrolled && !isEditing ? 'bg-background/80 backdrop-blur-sm shadow-sm' : ''}
        `}
        style={!isEditing ? {
          transform: 'translateZ(0)',
          // Use unified CSS variable - BannerProvider manages all banner heights including save banner
          top: 'var(--banner-stack-height, 0px)'
        } : {}}
      >
        {/* Full width in edit mode, sidebar-aware in view mode */}
        <div className="flex w-full h-full">
          {/* Sidebar spacer - only in view mode on desktop */}
          {!isEditing && (
            <div
              className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
              style={{ width: `${headerSidebarWidth}px` }}
            />
          )}

          {/* Header content area - full width in edit mode */}
          <div className={`${isEditing ? 'w-full' : 'flex-1 min-w-0'} relative px-4 header-padding-mobile`}>
            {/* Unified morphing header layout */}
            <div
              className="transition-all duration-300 ease-out"
              style={{
                paddingTop: `${headerPadding}px`,
                paddingBottom: `${headerPadding}px`,
                transform: 'translateZ(0)', // Force GPU acceleration
              }}
            >
              {/* Row 1: Back Button + Logo + Share Button - morphs based on scroll */}
              <div className={`flex items-center transition-all duration-300 ease-out ${
                isScrolled && !isEditing ? 'justify-center' : 'justify-between'
              }`}>
                {/* Left: Back Button - fades out when collapsed */}
                <div className={`flex items-center gap-2 transition-all duration-300 ease-out ${
                  isScrolled && !isEditing 
                    ? 'opacity-0 w-0 overflow-hidden pointer-events-none' 
                    : 'opacity-100 w-10'
                }`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-foreground"
                    onClick={handleBackClick}
                    title="Go back"
                  >
                    <Icon name="ChevronLeft" size={20} />
                  </Button>
                </div>

                {/* Center: Logo + Title (when collapsed) - Logo slides and shrinks */}
                <div
                  className={`flex items-center cursor-pointer transition-all duration-300 ease-out ${
                    isScrolled && !isEditing ? 'gap-2' : 'gap-0'
                  }`}
                  onClick={handleLogoClick}
                >
                  {/* Logo - transitions between lg and sm size */}
                  <div className="transition-all duration-300 ease-out">
                    <Logo 
                      size={isScrolled && !isEditing ? "sm" : "lg"} 
                      priority={true} 
                      styled={true} 
                      clickable={true} 
                    />
                  </div>
                  
                  {/* Collapsed title - slides in from right */}
                  <div className={`flex items-center gap-1 min-w-0 transition-all duration-300 ease-out ${
                    isScrolled && !isEditing 
                      ? 'opacity-100 max-w-[200px] translate-x-0' 
                      : 'opacity-0 max-w-0 translate-x-4 overflow-hidden'
                  }`}>
                    <h1 className="text-xs font-semibold opacity-90 truncate whitespace-nowrap">
                      {(isExactDateFormat(title || "") && title !== "Daily note") && title
                        ? (typeof window !== 'undefined' ? formatDate(title) : title)
                        : title
                        ? title
                        : isNewPage
                        ? (isReply ? "Give your reply a title..." : "Give your page a title...")
                        : "Untitled"
                      }
                    </h1>
                  </div>
                </div>

                {/* Right: Share button - fades out when collapsed, disabled for new unsaved pages */}
                <div className={`flex items-center gap-2 transition-all duration-300 ease-out ${
                  isScrolled && !isEditing
                    ? 'opacity-0 w-0 overflow-hidden pointer-events-none'
                    : 'opacity-100 w-10'
                }`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`text-foreground ${isNewPage ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={isNewPage ? "Save page first to share" : "Share page"}
                    tabIndex={isNewPage ? 3 : undefined}
                    onClick={isNewPage ? undefined : handleShareClick}
                    disabled={isNewPage}
                  >
                    <Icon name="Share" size={20} />
                  </Button>
                </div>
              </div>

              {/* Row 2: Title - slides up and fades out when collapsed */}
              <div className={`transition-all duration-300 ease-out overflow-hidden ${
                isScrolled && !isEditing
                  ? 'opacity-0 max-h-0 mt-0 -translate-y-2'
                  : 'opacity-100 max-h-none mt-2 translate-y-0'
              }`}>
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
                      <Icon name="ChevronLeft" size={16} />
                    </Button>
                  )}

                  <div className="flex-1 text-center">
                    <h1 className="text-2xl font-semibold">
                      <div className="flex items-center justify-center relative">
                        {isEditing && canEdit && isEditingTitle && !(isExactDateFormat(title || "") && title !== "Daily note") ? (
                          <Textarea
                            ref={titleInputRef}
                            value={editingTitle}
                            onChange={handleTitleChange}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={handleTitleBlur}
                            onFocus={handleTitleFocus}
                            tabIndex={isNewPage ? 1 : undefined}
                            maxLength={TITLE_MAX_LENGTH}
                            className={`wewrite-title-input ${isTitleFocused ? "wewrite-active-input" : ""} w-full min-h-[64px] text-2xl font-semibold text-center resize-none overflow-hidden`}
                            placeholder={isNewPage ? (isReply ? "Give your reply a title..." : "Give your page a title...") : "Add a title..."}
                            rows={1}
                            warning={!!titleError || editingTitle.length >= TITLE_MAX_LENGTH}
                          />
                        ) : (
                          <div
                            className={`${canEdit && isEditing ? "wewrite-input wewrite-title-input min-h-[64px]" : ""} ${titleError ? "border-warning" : ""} w-full text-2xl font-semibold text-center ${canEdit ? "cursor-pointer hover:bg-muted/30 rounded-lg px-4 py-2" : ""} transition-all duration-200`}
                            onClick={handleTitleClick}
                            title={
                              (isExactDateFormat(title || "") && title !== "Daily note")
                                ? "Click to change date format"
                                : (canEdit ? (isEditing ? "Click to edit title" : "Click to edit page") : undefined)
                            }
                          >
                            <span
                              className={`break-words ${!title && (isNewPage || isReply) ? "text-muted-foreground" : ""}`}
                              suppressHydrationWarning={isExactDateFormat(title || "") && title !== "Daily note"}
                            >
                              {(isExactDateFormat(title || "") && title !== "Daily note") && title
                                ? (typeof window !== 'undefined' ? formatDate(title) : title)
                                : title
                                ? title
                                : isNewPage
                                ? (isReply ? "Give your reply a title..." : "Give your page a title...")
                                : "Untitled"
                              }
                            </span>
                          </div>
                        )}
                      </div>
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
                      <Icon name="ChevronRight" size={16} />
                    </Button>
                  )}
                </div>

                {/* Title Error Message */}
                {titleError && isEditing && canEdit && !isDailyNote && (
                  <div className="flex justify-center mt-2">
                    <p className="text-sm text-warning font-medium">
                      Pages must have a title
                    </p>
                  </div>
                )}

                {/* Title Length Warning and Counter - show when editing title */}
                {isEditingTitle && canEdit && (
                  <div className={`flex justify-center items-center gap-2 mt-2 transition-all duration-200 ${
                    editingTitle.length >= TITLE_WARNING_LENGTH ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {editingTitle.length >= TITLE_WARNING_LENGTH && editingTitle.length < TITLE_MAX_LENGTH && (
                      <p className="text-xs text-muted-foreground">
                        Long titles may be truncated in some views
                      </p>
                    )}
                    {editingTitle.length >= TITLE_MAX_LENGTH && (
                      <p className="text-xs text-warning">
                        Maximum title length reached
                      </p>
                    )}
                    <span className={`text-xs font-mono ${
                      editingTitle.length >= TITLE_MAX_LENGTH
                        ? 'text-warning'
                        : editingTitle.length >= TITLE_WARNING_LENGTH
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/50'
                    }`}>
                      {editingTitle.length}/{TITLE_MAX_LENGTH}
                    </span>
                  </div>
                )}

                {/* Title Settings Button - slides in when title is focused and user can edit */}
                {canEdit && isEditing && !isNewPage && pageId && (
                  <div
                    className={`flex justify-center overflow-hidden transition-all duration-300 ease-out ${
                      isTitleFocused || isEditingTitle
                        ? 'opacity-100 max-h-12 mt-2'
                        : 'opacity-0 max-h-0 mt-0'
                    }`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-7"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Title settings clicked, opening modal...');
                        setIsTitleSettingsOpen(true);
                      }}
                    >
                      <Icon name="Settings2" size={24} className="h-3.5 w-3.5" />
                      Title settings
                    </Button>
                  </div>
                )}
              </div>

              {/* Row 3: Byline - slides up and fades out when collapsed */}
              <div className={`transition-all duration-300 ease-out overflow-hidden ${
                isScrolled && !isEditing 
                  ? 'opacity-0 max-h-0 mt-0 -translate-y-2' 
                  : 'opacity-100 max-h-[50px] mt-2 translate-y-0'
              }`}>
                <div className="flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="whitespace-nowrap flex-shrink-0">by</span>
                      <UsernameBadge
                        userId={userId}
                        username={username}
                        tier={authorSubscription.tier}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

      {/* Title Settings Modal */}
      {pageId && (
        <TitleSettingsModal
          isOpen={isTitleSettingsOpen}
          onClose={() => setIsTitleSettingsOpen(false)}
          pageId={pageId}
          title={title || ''}
          alternativeTitles={localAlternativeTitles}
          onTitleChange={(newTitle) => {
            setEditingTitle(newTitle);
            onTitleChange?.(newTitle);
          }}
          onAlternativeTitlesChange={(titles) => {
            setLocalAlternativeTitles(titles);
            onAlternativeTitlesChange?.(titles);
          }}
          canEdit={canEdit}
        />
      )}
    </>
  );
}
