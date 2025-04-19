"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Loader, ChevronLeft, Share2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

import { getUsernameById } from "../utils/userUtils";

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
  groupId?: string;
  groupName?: string;
  scrollDirection?: string;
  isPrivate?: boolean;
}

export default function PageHeader({
  title,
  username,
  userId,
  isLoading = false,
  groupId,
  groupName,
  // scrollDirection is not used but kept for compatibility
  isPrivate = false,
}: PageHeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const [displayUsername, setDisplayUsername] = React.useState<string>(username || "Anonymous");

  // Fetch username if not provided but userId is available
  React.useEffect(() => {
    const fetchUsername = async () => {
      // Always set a default username first
      setDisplayUsername(username || "Anonymous");

      // Then try to fetch the actual username if we have a userId
      if (userId) {
        try {
          console.log("Fetching username for userId:", userId);
          const fetchedUsername = await getUsernameById(userId);
          if (fetchedUsername && fetchedUsername !== "Anonymous") {
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

  // Calculate and update header height when component mounts or when title/isScrolled changes
  React.useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);

        // Also update spacer height directly to ensure immediate sync
        if (spacerRef.current) {
          spacerRef.current.style.height = `${height}px`;
        }
      }
    };

    // Initial update
    updateHeaderHeight();

    // Add resize listener to recalculate on window resize
    window.addEventListener('resize', updateHeaderHeight);

    // Create a MutationObserver to watch for changes to the header
    const observer = new MutationObserver(updateHeaderHeight);

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
    let spacerUpdateTimeout: ReturnType<typeof setTimeout>;

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

          // Calculate scroll progress
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          const maxScroll = documentHeight - windowHeight;
          const progress = (lastScrollY / maxScroll) * 100;
          setScrollProgress(Math.min(progress, 100));

          // Don't update the spacer height during scroll - only after scrolling stops
          // This prevents layout shifts during scrolling
          clearTimeout(spacerUpdateTimeout);
          spacerUpdateTimeout = setTimeout(() => {
            if (headerRef.current && spacerRef.current) {
              const height = headerRef.current.offsetHeight;
              spacerRef.current.style.height = `${height}px`;
            }
          }, 200);

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

      // Update spacer height after scrolling stops
      if (headerRef.current && spacerRef.current) {
        const height = headerRef.current.offsetHeight;
        spacerRef.current.style.height = `${height}px`;
      }
    };

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', handleScrollEnd);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (spacerUpdateTimeout) {
        clearTimeout(spacerUpdateTimeout);
      }
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', handleScrollEnd);
      }
    };
  }, [isScrolled]);

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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out will-change-transform header-border-transition ${
          isScrolled
            ? "bg-background/80 backdrop-blur-sm shadow-sm"
            : "bg-background border-visible"
        }`}
        style={{
          transform: 'translateZ(0)' // Force GPU acceleration
        }}
      >
        <div className="relative mx-auto px-2 md:px-4">
          <div className={`flex items-center justify-between ${isScrolled ? 'py-0.5' : 'py-1'}`}>
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
            <div className="flex-1 flex justify-center items-center">
              <div
                className={`text-center space-y-0 transition-all duration-200 ease-out will-change-transform ${
                  isScrolled ? "flex flex-row items-center gap-2 pl-0" : "max-w-full"
                }`}
                style={{
                  transform: isScrolled ? "translateY(0)" : "translateY(0)",
                  maxWidth: isScrolled ? "95vw" : "100%"
                }}
              >
                <h1
                  className={`font-semibold transition-all duration-200 ease-out will-change-transform ${
                    isScrolled
                      ? "text-xs truncate opacity-90"
                      : "text-2xl mb-0.5"
                  }`}
                  style={{
                    maxWidth: isScrolled ? "80vw" : "100%"
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading title...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span>{title || "Untitled"}</span>
                      {isPrivate && <Lock className={`${isScrolled ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground flex-shrink-0`} />}
                    </div>
                  )}
                </h1>
                <p
                  className={`text-muted-foreground transition-all duration-200 ease-out will-change-transform ${
                    isScrolled
                      ? "text-xs mt-0 whitespace-nowrap overflow-hidden text-ellipsis inline-block"
                      : "text-sm mt-0.5 truncate"
                  }`}
                  style={{
                    maxWidth: isScrolled ? "30vw" : "100%"
                  }}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center">
                      <Loader className="h-3 w-3 animate-spin mr-1" />
                      <span>Loading author...</span>
                    </span>
                  ) : (
                    <>
                      {isScrolled ? "•" : ""}{" "}
                      {groupId && groupName ? (
                        <Link href={`/groups/${groupId}`} className="hover:underline">
                          <span data-component-name="PageHeader">in {groupName}</span>
                        </Link>
                      ) : (
                        <>
                          {isScrolled ? "" : "by"}{" "}
                          {userId ? (
                            <Link href={`/user/${userId}`} className="hover:underline">
                              <span data-component-name="PageHeader">{displayUsername}</span>
                            </Link>
                          ) : (
                            <span data-component-name="PageHeader">{displayUsername}</span>
                          )}
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Right Side - Share Button (only visible when not scrolled) */}
            <div className="flex items-center">
              <Button
                variant="outline"
                size="icon"
                className={`text-foreground transition-opacity duration-120 ${
                  isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: title || 'WeWrite Page',
                      url: window.location.href,
                    }).catch((error) => {
                      // Silent error handling - no toast
                      console.error('Error sharing:', error);
                    });
                  } else {
                    // Fallback for browsers that don't support the Web Share API
                    try {
                      navigator.clipboard.writeText(window.location.href);
                      // No toast notification
                    } catch (error) {
                      console.error('Error copying link:', error);
                    }
                  }
                }}
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {/* Scroll Progress Bar */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-120"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      <div
        ref={spacerRef}
        style={{
          height: `${headerHeight}px`,
          minHeight: `${headerHeight}px`,
          willChange: 'height',
          transition: 'height 300ms ease-out',
          transform: 'translateZ(0)' // Force GPU acceleration
        }}
        className="w-full flex-shrink-0 pointer-events-none"
        aria-hidden="true"
      /> {/* Dynamic spacer for fixed header with explicit min-height */}
    </>
  );
}