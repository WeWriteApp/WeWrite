"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthNav from "./AuthNav";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const headerRef = React.useRef<HTMLDivElement>(null);

  // Calculate and update header height
  React.useEffect(() => {
    const handleScroll = () => {
      // Update scroll state
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 10);

      // Calculate scroll progress for the progress bar
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);
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
      <header ref={headerRef} className={`sticky top-0 z-50 ${isScrolled ? 'shadow-sm' : ''}`}>
        <div className={`relative header-border-transition border-visible bg-background transition-all duration-200 ${isScrolled ? "h-14" : "h-20"}`}>
          <div className={`w-full flex items-center h-full px-6 transition-all duration-200`}>
            <div className="flex-1 flex items-center">
              {/* Auth navigation (sidebar toggle or login button) */}
              <AuthNav />
            </div>

            {/* Logo/Title (centered) */}
            <div className="flex items-center justify-center">
              <Link href="/" className="flex items-center space-x-2 transition-all duration-200 hover:scale-110 hover:text-primary">
                <span className="font-bold dark:text-white text-primary">WeWrite</span>
              </Link>
            </div>

            {/* New Page button (right side) */}
            <div className="flex-1 flex justify-end">
              <Button variant="outline" size="sm" asChild className="gap-1">
                <Link href="/direct-create">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Page</span>
                </Link>
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
    </>
  );
}