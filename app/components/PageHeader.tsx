"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Loader, Menu, Check, ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { Sheet, SheetTrigger } from "./ui/sheet";
import { Sidebar } from "./ui/sidebar";
import { PageMenu } from "./PageMenu";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator
} from "./ui/dropdown-menu";
import { toast } from "./ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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
  const [viewMode, setViewMode] = React.useState<'dense' | 'normal'>('normal');
  const [showParagraphModes, setShowParagraphModes] = React.useState(false);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const tooltipTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize viewMode from localStorage
  React.useEffect(() => {
    const storedMode = localStorage.getItem('pageViewMode');
    if (storedMode && ['dense', 'spaced', 'normal'].includes(storedMode)) {
      // Handle migration from 'spaced' to 'normal'
      const newMode = storedMode === 'spaced' ? 'normal' : storedMode;
      setViewMode(newMode as 'dense' | 'normal');
      if (storedMode === 'spaced') {
        localStorage.setItem('pageViewMode', 'normal');
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pageViewMode' && ['dense', 'spaced', 'normal'].includes(e.newValue || '')) {
        const newMode = e.newValue === 'spaced' ? 'normal' : e.newValue;
        setViewMode(newMode as 'dense' | 'normal');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

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
      
      // Show toast notification
      toast({
        title: "Link copied",
        description: "Page link copied to clipboard",
        variant: "success",
        duration: 2000,
      });
    }
  };

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

  const handleViewModeChange = (mode: 'dense' | 'normal') => {
    setViewMode(mode);
    // Implement additional logic for changing view mode here
    // For example, update localStorage, dispatch context events, etc.
    localStorage.setItem('pageViewMode', mode);
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-120 ${
          isScrolled
            ? "bg-background/80 backdrop-blur-sm shadow-sm"
            : "bg-background border-b border-border/40"
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
                      {isScrolled ? "•" : "by"}{" "}
                      {userId ? (
                        <Link href={`/user/${userId}`} className="hover:underline">
                          <span data-component-name="PageHeader">{username || "Anonymous"}</span>
                        </Link>
                      ) : (
                        <span data-component-name="PageHeader">{username || "Anonymous"}</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {/* Right Side - Combined Menu Controls */}
            <div className="flex items-center gap-2 ml-4">
              {/* Combined Menu Button */}
              <div className={`relative transition-opacity duration-120 ${
                isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-foreground h-10 w-10 shrink-0 transition-all duration-120 my-auto"
                      title="Page options"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <AnimatePresence mode="wait" initial={false}>
                      {!showParagraphModes ? (
                        <motion.div
                          key="main-menu"
                          initial={{ x: 0, opacity: 1 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -100, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Copy Link Option */}
                          <DropdownMenuItem onClick={copyLinkToClipboard}>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <Link2 className="h-4 w-4 stroke-current" />
                              </div>
                              <span>Copy Link</span>
                            </div>
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Paragraph Mode Option */}
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowParagraphModes(true);
                              return false;
                            }}
                            preventClose={true}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 flex items-center justify-center">
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
                                    <path d="M21 10H3" />
                                    <path d="M21 6H3" />
                                    <path d="M21 14H3" />
                                    <path d="M21 18H3" />
                                  </svg>
                                </div>
                                <span>Paragraph Mode</span>
                              </div>
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </DropdownMenuItem>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="paragraph-modes"
                          initial={{ x: 100, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 100, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Back to main menu */}
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowParagraphModes(false);
                              return false;
                            }}
                            preventClose={true}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronLeft className="h-4 w-4" />
                              <span>Back</span>
                            </div>
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Paragraph Mode Options */}
                          <DropdownMenuItem 
                            className={viewMode === 'dense' ? 'bg-accent/50' : ''} 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewModeChange('dense');
                              return false;
                            }}
                            preventClose={true}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                {viewMode === 'dense' && <Check className="h-4 w-4" />}
                              </div>
                              <span>Dense</span>
                            </div>
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            className={viewMode === 'normal' ? 'bg-accent/50' : ''} 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewModeChange('normal');
                              return false;
                            }}
                            preventClose={true}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                {viewMode === 'normal' && <Check className="h-4 w-4" />}
                              </div>
                              <span>Normal</span>
                            </div>
                          </DropdownMenuItem>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          {/* Scroll Progress Bar */}
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-120"
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