"use client";

import * as React from "react";
import Link from "next/link";
import Button from "./Button";
import { Loader } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
}

export default function PageHeader({ title, username, userId, isLoading = false }: PageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const tooltipTimerRef = React.useRef<NodeJS.Timeout | null>(null);

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

  const copyLinkToClipboard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      
      // Show tooltip and set timer to hide it
      setShowTooltip(true);
      
      // Clear any existing timer
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
      
      // Set new timer to hide tooltip after 0.7 seconds
      tooltipTimerRef.current = setTimeout(() => {
        setShowTooltip(false);
      }, 700);
    }
  };

  // Add document click listener to dismiss tooltip
  React.useEffect(() => {
    const handleDocumentClick = () => {
      if (showTooltip) {
        setShowTooltip(false);
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      // Clean up tooltip timer
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, [showTooltip]);

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
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className={`relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${isScrolled ? "py-1" : "py-2"}`}>
          <div className={`container flex items-center px-4 transition-all duration-200 ${isScrolled ? "justify-between" : ""}`}>
            <div className={`flex items-center min-w-0 ${isScrolled ? "space-x-3" : "space-x-4 flex-1"}`}>
              {/* Only show back button in expanded state */}
              {!isScrolled && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleBackClick}
                  className="hover:bg-muted text-foreground h-8 w-8 shrink-0 transition-all duration-200 my-auto"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    width="24" 
                    height="24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-4 w-4"
                  >
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </Button>
              )}
              <div className={`min-w-0 ${isScrolled ? "flex items-center space-x-2 py-1" : "py-1"}`}>
                <h1 className={`font-semibold line-clamp-3 transition-all ${isScrolled ? "text-sm" : "text-xl"}`}>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading title...</span>
                    </div>
                  ) : (
                    title || "Untitled"
                  )}
                </h1>
                <p className={`text-muted-foreground truncate transition-all ${isScrolled ? "text-xs mt-0" : "text-sm mt-0.5"}`}>
                  {isLoading ? (
                    <span className="inline-flex items-center">
                      <Loader className="h-3 w-3 animate-spin mr-1" />
                      <span>Loading author...</span>
                    </span>
                  ) : (
                    <>
                      by{" "}
                      {userId ? (
                        <Link href={`/user/${userId}`} className="hover:underline">
                          {username || "Anonymous"}
                        </Link>
                      ) : (
                        <span>{username || "Anonymous"}</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {/* Link copy button - only in expanded state */}
            {!isScrolled && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-muted text-foreground h-8 w-8 shrink-0 transition-all duration-200 my-auto"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent the document click from immediately hiding the tooltip
                    copyLinkToClipboard();
                  }}
                  title="Copy link to clipboard"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    width="24" 
                    height="24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-4 w-4"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </Button>
                
                {/* Animated tooltip */}
                <div 
                  className={`absolute right-0 top-full mt-1 px-2 py-1 bg-green-500 text-white text-xs rounded shadow-md whitespace-nowrap z-50 transition-all duration-200 origin-top-right ${
                    showTooltip ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                  }`}
                >
                  Link copied to clipboard!
                </div>
              </div>
            )}
          </div>
          {/* Scroll Progress Bar */}
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-200"
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