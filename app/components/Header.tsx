"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthNav from "./AuthNav";

export default function Header() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);

  // Calculate and update header height
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
  }, []);

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

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className={`relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${isScrolled ? "h-14" : "h-20"}`}>
          <div className={`container flex items-center h-full px-6 transition-all duration-200`}>
            <div className="flex-1 flex items-center">
              {/* Auth navigation (sidebar toggle or login button) */}
              <AuthNav />
            </div>

            {/* Logo/Title (centered) */}
            <div className="flex items-center justify-center">
              <Link href="/" className="flex items-center space-x-2">
                <span className="font-bold">WeWrite</span>
              </Link>
            </div>

            {/* Empty div to maintain centering */}
            <div className="flex-1" />
          </div>
          {/* Scroll Progress Bar */}
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      <div 
        ref={spacerRef} 
        style={{ height: `${headerHeight || 80}px`, minHeight: `${headerHeight || 80}px` }} 
        className="w-full flex-shrink-0"
      /> {/* Dynamic spacer with fallback height */}
    </>
  );
} 