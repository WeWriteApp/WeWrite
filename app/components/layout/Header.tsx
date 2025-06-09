"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthNav from "../auth/AuthNav";
import { Button } from "../ui/button";
import { Heart } from "lucide-react";
import SupportUsModal from "../payments/SupportUsModal";
import { useSidebarContext } from "./UnifiedSidebar";

export default function Header() {
  const router = useRouter();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [showSupportModal, setShowSupportModal] = React.useState(false);
  const headerRef = React.useRef<HTMLDivElement>(null);

  // Calculate header positioning width - only respond to persistent expanded state, not hover
  // Hover state should overlay without affecting header positioning
  const headerSidebarWidth = React.useMemo(() => {
    // Only adjust header position for persistent expanded state
    // Hover state (temporary overlay) should not affect header positioning
    if (isExpanded && !isHovering) {
      return sidebarWidth; // Use full expanded width (256px)
    } else if (sidebarWidth > 0) {
      return 64; // Use collapsed width (64px) for both collapsed and hover states
    } else {
      return 0; // No sidebar (user not authenticated)
    }
  }, [isExpanded, isHovering, sidebarWidth]);

  // Calculate and update header height
  React.useEffect(() => {
    const handleScroll = () => {
      // Update scroll state
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 10);

      // Calculate scroll progress for the progress bar based on main content area only
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;

      // Find the main content area (exclude footer sections)
      const mainContentElement = document.querySelector('[data-page-content]');
      let contentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (mainContentElement) {
        // Calculate the height up to the end of main content
        const mainContentRect = mainContentElement.getBoundingClientRect();
        const mainContentBottom = mainContentRect.bottom + window.scrollY;
        const viewportHeight = window.innerHeight;

        // Use the main content bottom as the effective scroll height
        contentHeight = Math.max(0, mainContentBottom - viewportHeight);
      }

      const scrolled = contentHeight > 0 ? (winScroll / contentHeight) * 100 : 0;
      setScrollProgress(Math.min(scrolled, 100));
    };

    // Initial update
    handleScroll();

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Add scrollend event listener if supported
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', () => {
        // Update scroll state on scroll end
        handleScroll();
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
      <header
        ref={headerRef}
        className={`relative top-0 z-[60] transition-all duration-300 ease-in-out ${isScrolled ? 'shadow-sm' : ''}`}
        style={{
          left: window.innerWidth >= 768 ? `${headerSidebarWidth}px` : '0px', // Only respond to persistent expanded state
          right: '0px',
          width: window.innerWidth >= 768 ? `calc(100% - ${headerSidebarWidth}px)` : '100%' // Adjust width for persistent state only
        }}
      >
        <div className={`relative header-border-transition border-visible bg-background transition-all duration-200 ${isScrolled ? "h-14" : "h-20"}`}>
          <div className={`w-full flex items-center h-full px-6 transition-all duration-200`}>
            <div className="flex-1 flex items-center">
              {/* Auth navigation (sidebar toggle or login button) */}
              <AuthNav />
            </div>

            {/* Logo/Title (centered) */}
            <div className="flex items-center justify-center">
              <Link href="/" className="flex items-center space-x-2 transition-all duration-200 hover:scale-110 hover:text-primary">
                <span className="font-bold text-foreground">WeWrite</span>
              </Link>
            </div>

            {/* Support Us button (right side) */}
            <div className="flex-1 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white border-0 animate-gradient-x"
                onClick={() => setShowSupportModal(true)}
              >
                <Heart className="h-4 w-4 text-white fill-white" />
                <span className="hidden sm:inline">Support Us</span>
              </Button>
            </div>
          </div>
          {/* Scroll Progress Bar */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      {/* No spacer needed with sticky positioning */}

      {/* Support Us Modal */}
      <SupportUsModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </>
  );
}