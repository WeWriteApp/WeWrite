"use client";

import React, { useState, useContext, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Home, User, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { MobileOverflowSidebar } from './MobileOverflowSidebar';
import { useEditorContext } from './UnifiedSidebar';
import { cn } from '../../lib/utils';
import { isPWA } from '../../utils/pwa-detection';

/**
 * MobileBottomNav Component
 * 
 * A fixed bottom navigation toolbar for mobile devices with 4 main actions:
 * - Menu: Opens sidebar navigation
 * - Home: Navigate to home page
 * - Profile: Navigate to user's profile (authenticated users only)
 * - New Page: Create new page (authenticated users only)
 */
export default function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const editorContext = useEditorContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPWAMode, setIsPWAMode] = useState(false);

  // Check PWA mode on mount and window resize
  useEffect(() => {
    const checkPWAMode = () => {
      setIsPWAMode(isPWA());
    };

    checkPWAMode();
    window.addEventListener('resize', checkPWAMode);
    return () => window.removeEventListener('resize', checkPWAMode);
  }, []);

  // Don't render if no user (will show login buttons instead)
  if (!user) {
    return null;
  }

  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const handleHomeClick = () => {
    router.push('/');
  };

  const handleProfileClick = () => {
    if (user?.uid) {
      router.push(`/user/${user.uid}`);
    }
  };

  const handleNewPageClick = () => {
    // Add source parameter to trigger slide-up animation (same as FAB)
    router.push('/new?source=mobile-nav');
  };

  // Determine active states for navigation buttons
  const isHomeActive = pathname === '/';
  const isProfileActive = pathname === `/user/${user?.uid}`;
  const isNewPageActive = pathname === '/new';
  const isMenuActive = sidebarOpen;

  return (
    <>
      {/* Bottom Navigation - Only visible on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border shadow-lg">
        <div className={cn(
          "flex items-center justify-around px-4 pt-3 pb-7 safe-area-bottom",
          // Add extra bottom padding in PWA mode to account for PWA bottom bar
          isPWAMode && "pb-9"
        )}>
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleMenuClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-16 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with accent color in light mode
              isMenuActive
                ? "bg-accent/10 text-accent border border-accent/30 dark:bg-accent/20 dark:text-accent dark:border-accent/40"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Menu"
            aria-pressed={isMenuActive}
          >
            <div className="flex flex-col items-center justify-center flex-1 gap-1">
              <Menu className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium text-center leading-none">Menu</span>
            </div>
          </Button>

          {/* Home Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleHomeClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-16 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with accent color in light mode
              isHomeActive
                ? "bg-accent/10 text-accent border border-accent/30 dark:bg-accent/20 dark:text-accent dark:border-accent/40"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Home"
            aria-pressed={isHomeActive}
          >
            <div className="flex flex-col items-center justify-center flex-1 gap-1">
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium text-center leading-none">Home</span>
            </div>
          </Button>

          {/* Profile Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleProfileClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-16 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with accent color in light mode
              isProfileActive
                ? "bg-accent/10 text-accent border border-accent/30 dark:bg-accent/20 dark:text-accent dark:border-accent/40"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Profile"
            aria-pressed={isProfileActive}
          >
            <div className="flex flex-col items-center justify-center flex-1 gap-1">
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium text-center leading-none">Profile</span>
            </div>
          </Button>

          {/* New Page Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleNewPageClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-16 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with accent color in light mode
              isNewPageActive
                ? "bg-accent/10 text-accent border border-accent/30 dark:bg-accent/20 dark:text-accent dark:border-accent/40"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="New Page"
            aria-pressed={isNewPageActive}
          >
            <div className="flex flex-col items-center justify-center flex-1 gap-1">
              <Plus className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium text-center leading-none">New Page</span>
            </div>
          </Button>
        </div>
      </div>

      {/* Mobile Overflow Sidebar */}
      {user && (
        <MobileOverflowSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          editorProps={editorContext.onSave ? editorContext : undefined}
        />
      )}
    </>
  );
}
