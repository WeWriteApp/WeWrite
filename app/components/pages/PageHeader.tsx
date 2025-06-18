"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Loader, ChevronLeft, ChevronRight, Share2, Lock, Globe, MoreHorizontal, Edit2, Plus, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { ref, get } from "firebase/database";
import { rtdb } from "../../firebase/rtdb";
import dynamic from 'next/dynamic';

import { getUsernameById, getUserSubscriptionTier } from "../../utils/userUtils";
import { SupporterIcon } from "../payments/SupporterIcon";
import { SubscriptionInfoModal } from "../payments/SubscriptionInfoModal";
import PageOwnershipDropdown from "./PageOwnershipDropdown";
import ClickableByline from "../utils/ClickableByline";
import { useAuth } from "../../providers/AuthProvider";
import { handleAddToPage, handleReply, handleShare } from "../../utils/pageActionHandlers";
import { useFeatureFlag } from "../../utils/feature-flags";
import { useSidebarContext } from "../layout/UnifiedSidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "../ui/dropdown-menu";
import { Switch } from "../ui/switch";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { DateFormatPicker } from "../ui/date-format-picker";
import {
  navigateToPreviousDailyNote,
  navigateToNextDailyNote,
  isExactDateFormat as isDailyNoteFormat
} from "../../utils/dailyNoteNavigation";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext";

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
  groupId?: string;
  groupName?: string;
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
  onOwnershipChange?: (newGroupId: string | null, newGroupName: string | null) => void;
  isNewPage?: boolean; // Add flag to indicate this is a new page
  onPrivacyChange?: (isPublic: boolean) => void; // Add handler for privacy toggle
}

export default function PageHeader({
  title,
  username,
  userId,
  isLoading = false,
  groupId: initialGroupId,
  groupName: initialGroupName,
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
}: PageHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const { trackInteractionEvent, events } = useWeWriteAnalytics();
  const headerRef = React.useRef<HTMLDivElement>(null);
  const { lineMode, setLineMode } = useLineSettings();

  // Calculate header positioning width - only respond to persistent expanded state, not hover
  // Hover state should overlay without affecting header positioning
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
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const [displayUsername, setDisplayUsername] = React.useState<string>(username || "Anonymous");
  const [tier, setTier] = React.useState<string | null>(initialTier || null);
  const [subscriptionStatus, setSubscriptionStatus] = React.useState<string | null>(initialStatus || null);
  const [isLoadingTier, setIsLoadingTier] = React.useState<boolean>(false);
  const subscriptionEnabled = useFeatureFlag('payments', user?.email);
  const [groupId, setGroupId] = React.useState<string | null>(initialGroupId || null);
  const [groupName, setGroupName] = React.useState<string | null>(initialGroupName || null);
  const [pageId, setPageId] = React.useState<string | null>(propPageId);
  const [hasGroupAccess, setHasGroupAccess] = React.useState<boolean>(false);
  const [isAddToPageOpen, setIsAddToPageOpen] = React.useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState<boolean>(false);
  const [editingTitle, setEditingTitle] = React.useState<string>(title || "");
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const [isTitleFocused, setIsTitleFocused] = React.useState<boolean>(false);
  const [isEditorFocused, setIsEditorFocused] = React.useState<boolean>(false);

  // Date formatting context
  const { formatDateString } = useDateFormat();

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

    if (!user) return false;

    // User is the page owner
    if (userId && user.uid === userId) return true;

    // Page belongs to a group and user is a member of that group
    if (groupId && hasGroupAccess) return true;

    return false;
  }, [propCanEdit, user, userId, groupId, hasGroupAccess]);

  // Update editing title when title prop changes
  React.useEffect(() => {
    setEditingTitle(title || "");
  }, [title]);

  // Auto-focus title input for new pages
  React.useEffect(() => {
    if (isNewPage && isEditing && canEdit && !title) {
      // Start editing the title immediately for new pages
      setIsEditingTitle(true);
      // Focus the input after state update
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isNewPage, isEditing, canEdit, title]);

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

    if (canEdit && isEditing) {
      setIsEditingTitle(true);
      // Focus the input after state update
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
  }, [userId]);

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
  }, [userId, username]);

  // Extract page ID from URL and determine if user can change ownership
  React.useEffect(() => {
    // Extract page ID from URL
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/');

    // The page ID is the first segment if it's not empty and not a special route
    if (pathSegments.length > 1 && pathSegments[1] &&
        !['user', 'group', 'admin', 'search', 'new', 'settings'].includes(pathSegments[1])) {
      const extractedPageId = pathSegments[1];
      setPageId(extractedPageId);

      // Check if the current user can change ownership (is the page owner)
      if (user && userId && user.uid === userId) {
        console.log("User can change page ownership");
      }
    }
  }, [user, userId]);

  // Check if user has access to the group
  React.useEffect(() => {
    if (!groupId || !user) {
      setHasGroupAccess(false);
      return;
    }

    const checkGroupAccess = async () => {
      try {
        const groupRef = ref(rtdb, 'groups/' + groupId);
        const groupSnapshot = await get(groupRef);

        if (groupSnapshot.exists()) {
          const groupData = groupSnapshot.val();
          // Check if the user is a member of the group
          const isMember = user.uid && groupData.members && groupData.members[user.uid];
          setHasGroupAccess(!!isMember);
        } else {
          setHasGroupAccess(false);
        }
      } catch (error) {
        console.error('Error checking group access:', error);
        setHasGroupAccess(false);
      }
    };

    checkGroupAccess();
  }, [groupId, user]);

  // Calculate and update header height when component mounts or when title/isScrolled changes
  React.useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        // Wait for any CSS transitions to complete before measuring
        setTimeout(() => {
          if (headerRef.current) {
            const height = headerRef.current.offsetHeight;
            setHeaderHeight(height);

            // Also update spacer height directly to ensure immediate sync
            if (spacerRef.current) {
              spacerRef.current.style.height = `${height}px`;
            }
          }
        }, 350); // Wait slightly longer than the 300ms transition duration
      }
    };

    // Initial update
    updateHeaderHeight();

    // Add resize listener to recalculate on window resize
    window.addEventListener('resize', updateHeaderHeight);

    // Create a MutationObserver to watch for changes to the header
    const observer = new MutationObserver(() => {
      // Debounce the mutation observer to avoid excessive updates
      setTimeout(updateHeaderHeight, 50);
    });

    if (headerRef.current) {
      observer.observe(headerRef.current, {
        attributes: true,
        childList: true,
        subtree: true
      });
    }

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      observer.disconnect();
    };
  }, [title, isScrolled]);

  React.useEffect(() => {
    // Use a throttled scroll handler for better performance
    let scrollTimeout: ReturnType<typeof setTimeout>;
    let lastScrollY = 0;
    let ticking = false;
    let heightUpdateTimeout: ReturnType<typeof setTimeout>;

    const updateSpacerHeight = () => {
      if (headerRef.current && spacerRef.current) {
        // Clear any pending height updates
        if (heightUpdateTimeout) {
          clearTimeout(heightUpdateTimeout);
        }

        // Wait for transitions to complete before measuring
        heightUpdateTimeout = setTimeout(() => {
          if (headerRef.current && spacerRef.current) {
            const height = headerRef.current.offsetHeight;
            spacerRef.current.style.height = `${height}px`;
            setHeaderHeight(height);
          }
        }, 350); // Wait for CSS transitions to complete
      }
    };

    const handleScroll = () => {
      lastScrollY = window.scrollY;

      // Use requestAnimationFrame for smoother performance
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Update scroll state - only change if needed
          const shouldBeScrolled = lastScrollY > 0;
          if (shouldBeScrolled !== isScrolled) {
            setIsScrolled(shouldBeScrolled);
            // Update spacer height when scroll state changes
            updateSpacerHeight();
          }

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

    // Initial call to set up the spacer height
    updateSpacerHeight();

    // Use passive event listener for better performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also add scrollend event listener for modern browsers
    const handleScrollEnd = () => {
      // When scrolling stops, check if we're at the top
      if (window.scrollY < 5) {
        // Force scroll to absolute top to avoid partial header overlay
        window.scrollTo({top: 0, behavior: 'instant'});
      }

      // Update spacer height after scrolling stops
      updateSpacerHeight();
    };

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', handleScrollEnd);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (heightUpdateTimeout) {
        clearTimeout(heightUpdateTimeout);
      }
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
  }, [pageId, title, userId, displayUsername]);

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
          left: window.innerWidth >= 768 ? `${headerSidebarWidth}px` : '0px', // Only respond to persistent expanded state
          right: '0px',
          width: window.innerWidth >= 768 ? `calc(100% - ${headerSidebarWidth}px)` : '100%' // Adjust width for persistent state only
        }}
      >
        <div className="relative mx-auto px-2 md:px-4">
          <div className={`flex items-center justify-between ${isScrolled ? 'py-1' : 'py-2'}`}>
            {/* Left Side - Back Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className={`md:mr-2 text-foreground transition-opacity duration-120 ${
                  isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                onClick={handleBackClick}
                title="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>

            {/* Center - Title and Author */}
            <div
              className={`flex-1 flex justify-center items-center ${isScrolled ? "cursor-pointer" : ""}`}
              onClick={isScrolled ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
            >
              {/* Left navigation chevron for daily notes */}
              {isDailyNote && !isScrolled && (
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

              {/* Edit icon positioned outside and to the left of title container */}
              {isEditing && canEdit && !isScrolled && !isDailyNote && (
                <Edit2
                  className="h-4 w-4 opacity-60 hover:opacity-100 transition-opacity duration-200 text-muted-foreground flex-shrink-0 mr-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTitleClick();
                  }}
                  title="Click to edit title"
                />
              )}

              <div
                className={`text-center space-y-0 transition-all duration-200 ease-out will-change-transform ${
                  isScrolled ? "flex flex-row items-center gap-2 pl-0" : "max-w-full"
                }`}
                style={{
                  transform: isScrolled ? "translateY(0)" : "translateY(0)",
                  maxWidth: isScrolled ? "calc(100% - 16px)" : "100%",
                  margin: isScrolled ? "0 8px" : "0"
                }}
              >
                <h1
                  className={`font-semibold transition-all duration-200 ease-out will-change-transform ${
                    isScrolled
                      ? "text-xs opacity-90"
                      : "text-2xl mb-0.5"
                  }`}
                  style={{
                    maxWidth: isScrolled ? "70vw" : "100%"
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading title...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {isEditing && canEdit && isEditingTitle ? (
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={handleTitleKeyDown}
                          onBlur={handleTitleBlur}
                          onFocus={handleTitleFocus}
                          tabIndex={isNewPage ? 1 : undefined} // Explicit first position for new pages
                          className={`bg-background/80 border rounded-lg px-2 py-1 outline-none font-semibold text-center transition-all duration-200 ${
                            titleError
                              ? "border-destructive focus:ring-2 focus:ring-destructive/20 focus:border-destructive"
                              : isTitleFocused
                              ? "border-primary/50 ring-2 ring-primary/20"
                              : "border-muted-foreground/30 ring-2 ring-muted-foreground/10"
                          } ${
                            isScrolled
                              ? "text-xs opacity-90"
                              : "text-2xl"
                          }`}
                          style={{
                            maxWidth: isScrolled ? "60vw" : "100%",
                            minWidth: isScrolled ? "120px" : "200px", // Maintain minimum width
                            width: isScrolled ? "auto" : "300px" // Fixed width when not scrolled
                          }}
                          placeholder={isNewPage ? "Give your page a title..." : "Add a title..."}
                        />
                      ) : (
                        <span
                          className={`${isScrolled ? "text-ellipsis overflow-hidden" : ""} ${
                            isEditing && canEdit && !isDailyNote
                              ? `cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 border transition-all duration-200 ${
                                  titleError
                                    ? "border-destructive hover:border-destructive/70"
                                    : isEditorFocused
                                    ? "border-muted-foreground/30 ring-2 ring-muted-foreground/10"
                                    : "border-muted-foreground/20 hover:border-muted-foreground/30"
                                }`
                              : isDailyNote && !isScrolled
                              ? "flex flex-col items-center gap-1 cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 border border-muted-foreground/20 hover:border-muted-foreground/30 transition-all duration-200"
                              : isDailyNote
                              ? "cursor-pointer"
                              : ""
                          }`}
                          style={isScrolled ? {
                            maxWidth: '60vw',
                            display: 'inline-block',
                            verticalAlign: 'middle',
                            whiteSpace: 'nowrap',
                            paddingRight: '4px'
                          } : {
                            minWidth: "200px", // Maintain same minimum width as input
                            width: "300px", // Maintain same width as input
                            display: 'inline-block'
                          }}
                          onClick={handleTitleClick}
                          title={
                            isDailyNote
                              ? "Click to change date format"
                              : (isEditing && canEdit ? "Click to edit title" : undefined)
                          }
                        >
                          <span className={!title && isNewPage ? "text-muted-foreground" : ""}>
                            {isDailyNote && title
                              ? formatDateString(title)
                              : title
                              ? title
                              : isNewPage
                              ? "Give your page a title..."
                              : "Untitled"
                            }
                          </span>
                        </span>
                      )}
                      {isPrivate && <Lock className={`${isScrolled ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground flex-shrink-0`} />}
                    </div>
                  )}
                </h1>
                <div
                  className={`text-muted-foreground transition-all duration-200 ease-out will-change-transform ${
                    isScrolled
                      ? "text-xs mt-0 whitespace-nowrap overflow-hidden text-ellipsis inline-block"
                      : "text-sm mt-0.5"
                  }`}
                  style={{
                    maxWidth: isScrolled ? "25vw" : "100%",
                    minWidth: isScrolled ? "auto" : "auto"
                  }}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center"><Loader className="h-3 w-3 animate-spin mr-1" />Loading...</span>
                  ) : (
                    groupId && groupName ? (
                      <span className="flex items-center gap-1 justify-center mx-auto">
                        <span className="whitespace-nowrap flex-shrink-0">in</span>
                        {/* Show ClickableByline only in edit mode for page owners, otherwise show Link for navigation */}
                        {user && userId && user.uid === userId && pageId && isEditing ? (
                          <ClickableByline
                            isLoading={isLoading}
                            isChanging={false}
                            dropdown={
                              <PageOwnershipDropdown
                                pageId={pageId}
                                userId={userId}
                                username={displayUsername}
                                groupId={groupId}
                                groupName={groupName}
                                onOwnershipChange={(newGroupId, newGroupName) => {
                                  setGroupId(newGroupId);
                                  setGroupName(newGroupName);
                                  if (onOwnershipChange) {
                                    onOwnershipChange(newGroupId, newGroupName);
                                  }
                                }}
                              />
                            }
                          >
                            <span data-component-name="PageHeader" data-group-name={groupName} className="overflow-hidden text-ellipsis">{groupName}</span>
                          </ClickableByline>
                        ) : (
                          <Link href={`/group/${groupId}`} className="hover:underline overflow-hidden text-ellipsis">
                            <span data-component-name="PageHeader" data-group-name={groupName}>{groupName}</span>
                          </Link>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 justify-center mx-auto">
                        <span className="whitespace-nowrap flex-shrink-0">by</span>
                        {/* Show ClickableByline only in edit mode for page owners, otherwise show Link for navigation */}
                        {/* For new pages, make username non-interactive to improve tab order */}
                        {isNewPage ? (
                          <span className="overflow-hidden text-ellipsis">
                            {isLoading || !displayUsername ? (
                              <span className="inline-flex items-center text-muted-foreground"><Loader className="h-3 w-3 animate-spin mr-1" />Loading...</span>
                            ) : (
                              <span data-component-name="PageHeader" className="overflow-hidden text-ellipsis">{displayUsername}</span>
                            )}
                          </span>
                        ) : user && userId && user.uid === userId && pageId && isEditing ? (
                          <ClickableByline
                            isLoading={isLoading}
                            isChanging={false}
                            dropdown={
                              <PageOwnershipDropdown
                                pageId={pageId}
                                userId={userId}
                                username={displayUsername}
                                onOwnershipChange={(newGroupId, newGroupName) => {
                                  setGroupId(newGroupId);
                                  setGroupName(newGroupName);
                                  if (onOwnershipChange) {
                                    onOwnershipChange(newGroupId, newGroupName);
                                  }
                                }}
                              />
                            }
                          >
                            {isLoading || !displayUsername ? (
                              <span className="inline-flex items-center text-muted-foreground"><Loader className="h-3 w-3 animate-spin mr-1" />Loading...</span>
                            ) : (
                              <span data-component-name="PageHeader" className="overflow-hidden text-ellipsis">{displayUsername}</span>
                            )}
                          </ClickableByline>
                        ) : (
                          <Link href={`/user/${userId}`} className="hover:underline overflow-hidden text-ellipsis">
                            {isLoading || !displayUsername ? (
                              <span className="inline-flex items-center text-muted-foreground"><Loader className="h-3 w-3 animate-spin mr-1" />Loading...</span>
                            ) : (
                              <span data-component-name="PageHeader" className="overflow-hidden text-ellipsis">{displayUsername}</span>
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
                    )
                  )}
                </div>
              </div>

              {/* Right navigation chevron for daily notes */}
              {isDailyNote && !isScrolled && (
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

            {/* Right Side - Action Menu (only visible when not scrolled) */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`text-foreground transition-opacity duration-120 ${
                      isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
                    }`}
                    title="Page actions"
                    tabIndex={isNewPage ? 3 : undefined} // Set to 3rd position: after title (1) and editor (2)
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

                      {/* Share option - always visible */}
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={handleShareClick}
                      >
                        <Share2 className="h-4 w-4" />
                        <span>Share</span>
                      </DropdownMenuItem>

                      {/* Add to Page option - hidden in edit mode */}
                      {!isEditing && (
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={handleAddToPageClick}
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add to Page</span>
                        </DropdownMenuItem>
                      )}

                      {/* Reply option - hidden in edit mode */}
                      {!isEditing && (
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={handleReplyClick}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>Reply</span>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        {/* Scroll Progress Bar - positioned outside padded container */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-120"
          style={{ width: `${scrollProgress}%` }}
        />
      </header>
      {/* Add spacer to prevent content from being hidden under the fixed header */}
      <div ref={spacerRef} style={{ height: headerHeight + 'px' }} />

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