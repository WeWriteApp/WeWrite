"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Loader, ChevronLeft } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { Sheet, SheetTrigger } from "./ui/sheet";
import { Sidebar } from "./ui/sidebar";
import { PageMenu } from "./PageMenu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getUsernameById } from "../utils/userUtils";

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
  groupId?: string;
  groupName?: string;
  scrollDirection?: string;
}

export default function PageHeader({
  title,
  username,
  userId,
  isLoading = false,
  groupId,
  groupName,
  scrollDirection
}: PageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const tooltipTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [displayUsername, setDisplayUsername] = React.useState<string>(username || "Anonymous");

  // Fetch username if not provided but userId is available
  React.useEffect(() => {
    const fetchUsername = async () => {
      if (userId && (!username || username === "Anonymous")) {
        try {
          const fetchedUsername = await getUsernameById(userId);
          if (fetchedUsername) {
            setDisplayUsername(fetchedUsername);
            console.log("Username fetched for PageHeader:", fetchedUsername);
          }
        } catch (error) {
          console.error("Error fetching username for header:", error);
        }
      } else if (username) {
        setDisplayUsername(username);
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
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 0);

      // Calculate scroll progress
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - windowHeight;
      const progress = (scrollPosition / maxScroll) * 100;
      setScrollProgress(Math.min(progress, 100));

      // Ensure spacer height is always correct
      if (headerRef.current && spacerRef.current) {
        spacerRef.current.style.height = `${headerRef.current.offsetHeight}px`;
      }
    };

    window.addEventListener("scroll", handleScroll);

    // Also add scrollend event listener for modern browsers
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', () => {
        // When scrolling stops, check if we're at the top
        if (window.scrollY < 5) {
          // Force scroll to absolute top to avoid partial header overlay
          window.scrollTo({top: 0, behavior: 'instant'});

          // Make sure header height is updated
          if (headerRef.current && spacerRef.current) {
            const height = headerRef.current.offsetHeight;
            spacerRef.current.style.height = `${height}px`;
          }
        }
      });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', () => {});
      }
    };
  }, []);

  // Function to handle back button click
  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();

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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-120 header-border-transition ${
          isScrolled
            ? "bg-background/80 backdrop-blur-sm shadow-sm"
            : "bg-background border-visible"
        }`}
      >
        <div className="relative mx-auto px-2 md:px-4">
          <div className="flex items-center justify-between py-1">
            {/* Left Side - Back Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
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
            <div className="flex-1 flex justify-start items-center ml-4">
              <div className={`text-left space-y-0 transition-all duration-120 ${
                isScrolled ? "max-w-[85vw] flex flex-row items-center gap-2" : "max-w-full"
              }`}>
                <h1 className={`font-semibold transition-all duration-120 ${
                  isScrolled
                    ? "text-base truncate max-w-[70vw]"
                    : "text-2xl mb-0.5"
                }`}>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading title...</span>
                    </div>
                  ) : (
                    title || "Untitled"
                  )}
                </h1>
                <p className={`text-muted-foreground transition-all duration-120 ${
                  isScrolled
                    ? "text-xs mt-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[30vw] inline-block"
                    : "text-sm mt-0.5 truncate"
                }`}>
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
        style={{ height: `${headerHeight}px`, minHeight: `${headerHeight}px` }}
        className="w-full flex-shrink-0"
      /> {/* Dynamic spacer for fixed header with explicit min-height */}
    </>
  );
}