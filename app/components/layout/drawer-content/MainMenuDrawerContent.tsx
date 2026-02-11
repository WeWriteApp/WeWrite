'use client';

/**
 * MainMenuDrawerContent
 *
 * Content for the main navigation menu drawer (mobile only).
 * - isMenuView=true: Shows the main navigation menu list
 * - isMenuView=false: Routes to Settings or Admin based on subPath
 *
 * This creates a unified mobile menu where Settings and Admin are sub-menus
 * that slide in from the right using DrawerNavigationStack.
 */

import React, { Suspense, lazy } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useGlobalDrawer } from '../../../providers/GlobalDrawerProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { useFeatureFlags } from '../../../contexts/FeatureFlagContext';
import { useBankSetupStatus } from '../../../hooks/useBankSetupStatus';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useEarnings } from '../../../contexts/EarningsContext';
import { Icon, IconName } from '@/components/ui/Icon';
import { Button } from '../../ui/button';
import NotificationBadge from '../../utils/NotificationBadge';

// Lazy load Settings and Admin drawer content
const SettingsDrawerContent = lazy(() => import('./SettingsDrawerContent'));
const AdminDrawerContent = lazy(() => import('./AdminDrawerContent'));

interface MainMenuDrawerContentProps {
  isMenuView: boolean;
  subPath?: string | null;
}

/**
 * Navigation menu item configuration
 */
interface NavItem {
  id: string;
  icon: IconName;
  label: string;
  route?: string;
  action?: 'settings' | 'admin';
  badge?: React.ReactNode;
  warningDot?: boolean;
  requiresAdmin?: boolean;
  requiresFeatureFlag?: string;
}

/**
 * Main navigation menu list
 */
function MainMenuList() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { navigateInDrawer, closeDrawer } = useGlobalDrawer();
  const { isEnabled: isFeatureEnabled } = useFeatureFlags();

  // Settings warning indicators
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useEarnings();
  const { hasActiveSubscription } = useSubscription();

  const hasSettingsWarning = (
    (hasActiveSubscription !== null && hasActiveSubscription === false) ||
    (earnings?.hasEarnings && !bankSetupStatus.isSetup)
  );

  // Navigation items configuration
  const navItems: NavItem[] = [
    { id: 'home', icon: 'Home', label: 'Home', route: '/' },
    { id: 'search', icon: 'Search', label: 'Search', route: '/search' },
    { id: 'profile', icon: 'User', label: 'Profile', route: user?.uid ? `/u/${user.uid}` : undefined },
    { id: 'notifications', icon: 'Bell', label: 'Notifications', route: '/notifications', badge: <NotificationBadge className="ml-2" /> },
    { id: 'leaderboard', icon: 'Trophy', label: 'Leaderboard', route: '/leaderboard' },
    { id: 'random-pages', icon: 'Shuffle', label: 'Random', route: '/random-pages' },
    { id: 'trending-pages', icon: 'TrendingUp', label: 'Trending', route: '/trending-pages' },
    { id: 'following', icon: 'Heart', label: 'Following', route: '/following' },
    { id: 'recents', icon: 'Clock', label: 'Recents', route: '/recents' },
    { id: 'invite', icon: 'UserPlus', label: 'Invite', route: '/invite' },
    { id: 'map', icon: 'Map', label: 'Map', route: '/map' },
    { id: 'groups', icon: 'Users', label: 'Groups', route: '/groups', requiresFeatureFlag: 'groups' },
    { id: 'settings', icon: 'Settings', label: 'Settings', action: 'settings', warningDot: hasSettingsWarning },
    { id: 'admin', icon: 'Shield', label: 'Admin', action: 'admin', requiresAdmin: true },
  ];

  // Filter items based on permissions and feature flags
  const filteredItems = navItems.filter(item => {
    if (item.requiresAdmin && !user?.isAdmin) return false;
    if (item.requiresFeatureFlag && !isFeatureEnabled(item.requiresFeatureFlag)) return false;
    if (item.id === 'profile' && !item.route) return false;
    return true;
  });

  const handleItemClick = (item: NavItem) => {
    if (item.action === 'settings') {
      // Navigate to settings sub-menu
      navigateInDrawer('settings');
    } else if (item.action === 'admin') {
      // Navigate to admin sub-menu
      navigateInDrawer('admin');
    } else if (item.route) {
      // Navigate to route - just push the new route, the hash will be replaced
      // Don't call closeDrawer() as it manipulates history which conflicts with router.push
      router.push(item.route);
    }
  };

  const isRouteActive = (route: string, itemId: string) => {
    if (itemId === 'home' && (pathname === '/' || pathname === '/home' || pathname === '')) return true;
    if (itemId === 'profile' && user && pathname?.startsWith(`/u/${user.uid}`)) return true;
    return pathname === route;
  };

  return (
    <div className="h-full overflow-y-auto divide-y divide-border pb-safe">
      {filteredItems.map((item) => {
        const isActive = item.route ? isRouteActive(item.route, item.id) : false;
        const hasChevron = !!item.action; // Show chevron for sub-menu items

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="w-full flex items-center justify-between px-4 py-4 text-left nav-hover-state nav-active-state transition-colors select-none"
          >
            <div className="flex items-center">
              <div className="relative">
                <Icon
                  name={item.icon}
                  size={20}
                  className={isActive ? "text-accent mr-3" : "text-foreground mr-3"}
                />
                {item.warningDot && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-background" />
                )}
              </div>
              <span className={isActive ? "font-medium text-accent" : "font-medium"}>
                {item.label}
              </span>
              {item.badge}
            </div>
            {hasChevron && (
              <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
            )}
          </button>
        );
      })}

      {/* User info and logout */}
      {user && (
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center">
            <Icon name="User" size={20} className="mr-3 text-muted-foreground" />
            <span className="font-medium">{user.username || 'User'}</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (window.confirm('Are you sure you want to log out?')) {
                await signOut();
              }
            }}
          >
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Loading fallback
 */
function ContentLoading() {
  return (
    <div className="flex items-center justify-center h-32">
      <Icon name="Loader" className="text-muted-foreground animate-spin" size={20} />
    </div>
  );
}

/**
 * Route to Settings or Admin based on subPath
 */
function MainMenuSubContent({ subPath }: { subPath: string }) {
  // Parse the subPath to determine which sub-menu to show
  // subPath can be: 'settings', 'settings/profile', 'admin', 'admin/users', etc.
  const parts = subPath.split('/');
  const rootPath = parts[0]; // 'settings' or 'admin'
  const remainingPath = parts.slice(1).join('/') || null; // 'profile', 'users', etc.

  if (rootPath === 'settings') {
    // Determine if we're at the settings menu or a settings sub-page
    const isSettingsMenuView = !remainingPath;
    return (
      <Suspense fallback={<ContentLoading />}>
        <SettingsDrawerContent isMenuView={isSettingsMenuView} subPath={remainingPath} />
      </Suspense>
    );
  }

  if (rootPath === 'admin') {
    // Determine if we're at the admin menu or an admin sub-page
    const isAdminMenuView = !remainingPath;
    return (
      <Suspense fallback={<ContentLoading />}>
        <AdminDrawerContent isMenuView={isAdminMenuView} subPath={remainingPath} />
      </Suspense>
    );
  }

  // Unknown path
  return (
    <div className="p-4 text-center text-muted-foreground">
      <p>Content not found for: {subPath}</p>
    </div>
  );
}

export default function MainMenuDrawerContent({ isMenuView, subPath }: MainMenuDrawerContentProps) {
  if (isMenuView) {
    return <MainMenuList />;
  }

  if (!subPath) {
    return null;
  }

  return <MainMenuSubContent subPath={subPath} />;
}
