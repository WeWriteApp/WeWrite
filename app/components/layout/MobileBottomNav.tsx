"use client";

import React, { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Home, User, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { MobileOverflowSidebar } from './MobileOverflowSidebar';
import { useEditorContext } from './UnifiedSidebar';
import { cn } from '../../lib/utils';

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
  const { user } = useAuth();
  const editorContext = useEditorContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <>
      {/* Bottom Navigation - Only visible on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border shadow-lg">
        <div className="flex items-center justify-around px-4 py-3 safe-area-bottom">
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleMenuClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-12 min-w-[60px] rounded-lg",
              "hover:bg-accent/10 active:bg-accent/20 transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-medium">Menu</span>
          </Button>

          {/* Home Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleHomeClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-12 min-w-[60px] rounded-lg",
              "hover:bg-accent/10 active:bg-accent/20 transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Button>

          {/* Profile Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleProfileClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-12 min-w-[60px] rounded-lg",
              "hover:bg-accent/10 active:bg-accent/20 transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Button>

          {/* New Page Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleNewPageClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-12 min-w-[60px] rounded-lg",
              "hover:bg-accent/10 active:bg-accent/20 transition-colors",
              "text-primary hover:text-primary/80"
            )}
            aria-label="New Page"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">New Page</span>
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
