'use client';

/**
 * GlobalDrawerRenderer
 *
 * Renders the settings or admin drawer as an overlay on mobile.
 * This component lives at the root level and renders the drawer
 * on top of whatever page content is currently visible.
 *
 * ARCHITECTURE (State-Driven with Hash Deep Links):
 * - Drawer state is managed by GlobalDrawerProvider
 * - NO page navigation occurs when drawer opens (content stays rendered)
 * - Hash fragments are used for deep linking (#settings/profile)
 * - Browser back button closes drawer via hashchange handling
 *
 * KEY DESIGN: Full-screen overlay covers everything including the header,
 * providing a standard modal experience where the drawer takes focus.
 *
 * URL Examples:
 * - /home#settings          -> Settings drawer on menu
 * - /home#settings/profile  -> Settings drawer on profile
 * - /[id]#admin/users       -> Admin drawer on users page
 */

import React, { Suspense, lazy, useState } from 'react';
import { useGlobalDrawer } from '../../providers/GlobalDrawerProvider';
import { useAuth } from '../../providers/AuthProvider';
import { Drawer, DrawerContent, DrawerHeader } from '../ui/drawer';
import { DrawerNavigationStack, ANIMATION_DURATION } from '../ui/drawer-navigation-stack';
import { Icon } from '@/components/ui/Icon';
import { cn } from '../../lib/utils';

// Lazy load drawer content components
const SettingsDrawerContent = lazy(() => import('./drawer-content/SettingsDrawerContent'));
const AdminDrawerContent = lazy(() => import('./drawer-content/AdminDrawerContent'));

/**
 * Loading fallback for drawer content
 */
function DrawerLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Icon name="Loader" className="text-muted-foreground" size={24} />
    </div>
  );
}

/**
 * Map of subPath to display title
 * These should match the menu titles in useSettingsSections and admin sections
 */
const SUBPATH_TITLES: Record<string, string> = {
  // Settings
  'fund-account': 'Fund Account',
  'spend': 'Manage Spending',
  'earnings': 'Get paid',
  'profile': 'Profile',
  'appearance': 'Appearance',
  'notifications': 'Notifications',
  'email-preferences': 'Email Preferences',
  'security': 'Security',
  'deleted': 'Recently deleted',
  'advanced': 'Advanced',
  // Admin
  'users': 'Users',
  'user-activation': 'User Activation',
  'notifications-admin': 'Notifications',
  'product-kpis': 'Product KPIs',
  'monthly-financials': 'Monthly Financials',
  'design-system': 'Design System',
  'system-diagram': 'System Diagram',
};

/**
 * Format subPath for display in header
 * Handles nested paths like 'users/abc123' -> 'User Details'
 * Also strips query parameters for display
 */
function formatSubPathTitle(subPath: string | null): string {
  if (!subPath) return '';

  // Strip query parameters for display (e.g., 'fund-account?topoff=true' -> 'fund-account')
  const pathWithoutQuery = subPath.split('?')[0];

  // Check for nested paths (e.g., 'users/abc123')
  const parts = pathWithoutQuery.split('/');
  if (parts.length > 1) {
    // Handle specific patterns
    if (parts[0] === 'users' && parts[1]) {
      return 'User Details';
    }
    // Generic fallback for nested paths - use title map or format path
    return SUBPATH_TITLES[parts[0]] || parts[0].replace(/-/g, ' ');
  }

  // Check title map first, then fallback to formatted path
  return SUBPATH_TITLES[pathWithoutQuery] || pathWithoutQuery.replace(/-/g, ' ');
}

/**
 * Animated header with back navigation
 */
function AnimatedDrawerHeader({
  title,
  subTitle,
  onBack,
  onClose,
}: {
  title: string;
  subTitle: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const isDetail = subTitle !== null;
  const displayTitle = formatSubPathTitle(subTitle);

  return (
    <DrawerHeader className="relative overflow-hidden">
      <div className="relative h-10 flex items-center justify-center">
        {/* Root title - centered */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all ease-out",
            isDetail ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
          )}
          style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
        >
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        {/* Detail header - back button left, title centered */}
        <div
          className={cn(
            "absolute inset-0 flex items-center transition-all ease-out",
            isDetail ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          )}
          style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
        >
          {/* Left-aligned ghost back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-2 -ml-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Icon name="ChevronLeft" size={18} />
            <span className="text-sm font-medium">{title}</span>
          </button>

          {/* Centered page title */}
          <h2 className="flex-1 text-lg font-semibold text-center pr-[72px] capitalize">
            {displayTitle}
          </h2>
        </div>
      </div>
    </DrawerHeader>
  );
}

/**
 * Full-screen overlay that covers everything including the header
 * Uses z-[9998] to be above all fixed elements but below the drawer content (z-[9999])
 */
function FullScreenOverlay({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9998] bg-black/40 transition-opacity duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

export function GlobalDrawerRenderer() {
  const { drawerConfig, closeDrawer, goToDrawerRoot, isGlobalDrawerActive } = useGlobalDrawer();
  const { user, isLoading: authLoading } = useAuth();
  const [isClosing, setIsClosing] = useState(false);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    // Wait for animation then actually close
    setTimeout(() => {
      closeDrawer();
      setIsClosing(false);
    }, 300);
  };

  // Don't render if not on mobile or no drawer is open
  if (!isGlobalDrawerActive || !drawerConfig.type) {
    return null;
  }

  // Auth check for admin
  if (drawerConfig.type === 'admin' && (!user?.isAdmin || authLoading)) {
    return null;
  }

  // Auth check for settings
  if (drawerConfig.type === 'settings' && (!user || authLoading)) {
    return null;
  }

  const isSettings = drawerConfig.type === 'settings';
  const title = isSettings ? 'Settings' : 'Admin Panel';
  const height = isSettings ? '85vh' : '90vh';

  return (
    <>
      {/* Full-screen overlay that covers everything */}
      <FullScreenOverlay isOpen={!isClosing} onClick={handleClose} />

      <Drawer
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
        // Note: Analytics tracking is handled by GlobalDrawerProvider, not here
        // to avoid duplicate page view tracking
      >
        <DrawerContent
          height={height}
          showOverlay={false}
          accessibleTitle={title}
          className="z-[9999]"
        >
        <AnimatedDrawerHeader
          title={title}
          subTitle={drawerConfig.subPath}
          onBack={goToDrawerRoot}
          onClose={handleClose}
        />

        <DrawerNavigationStack
          activeView={drawerConfig.subPath}
          className="flex-1"
        >
          <DrawerNavigationStack.Root className="overflow-y-auto">
            <Suspense fallback={<DrawerLoadingFallback />}>
              {isSettings ? (
                <SettingsDrawerContent isMenuView={true} />
              ) : (
                <AdminDrawerContent isMenuView={true} />
              )}
            </Suspense>
          </DrawerNavigationStack.Root>

          <DrawerNavigationStack.Detail className="overflow-y-auto pb-safe">
            <Suspense fallback={<DrawerLoadingFallback />}>
              {isSettings ? (
                <SettingsDrawerContent isMenuView={false} subPath={drawerConfig.subPath} />
              ) : (
                <AdminDrawerContent isMenuView={false} subPath={drawerConfig.subPath} />
              )}
            </Suspense>
          </DrawerNavigationStack.Detail>
        </DrawerNavigationStack>
      </DrawerContent>
    </Drawer>
    </>
  );
}

export default GlobalDrawerRenderer;
