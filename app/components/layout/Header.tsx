"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthNav from "../auth/AuthNav";
import { Button } from "../ui/button";
import { Heart } from "lucide-react";
import SupportUsModal from "../payments/SupportUsModal";

export default function Header() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [showSupportModal, setShowSupportModal] = React.useState(false);
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
      <header ref={headerRef} className={`relative left-0 right-0 z-[60] ${isScrolled ? 'shadow-sm' : ''}`}>
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