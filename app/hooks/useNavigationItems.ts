'use client';

import { useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useNavigationOrder } from '../contexts/NavigationOrderContext';
import { useFeatureFlags } from '../contexts/FeatureFlagContext';
import { buildNewPageUrl } from '../utils/pageId';

export interface NavigationItem {
  id: string;
  icon: string;
  label: string;
  href: string;
  action?: () => void;
  keywords?: string[];
}

/**
 * Shared navigation items config.
 *
 * Single source of truth consumed by the desktop sidebar and command palette.
 * Returns items in canonical sidebar order, filtered by feature flags and user role.
 */
export function useNavigationItems(): NavigationItem[] {
  const { user } = useAuth();
  const router = useRouter();
  const { sidebarOrder } = useNavigationOrder();
  const { isEnabled } = useFeatureFlags();
  const groupsEnabled = isEnabled('groups');
  const isUserAdmin = user?.isAdmin === true;

  return useMemo(() => {
    const allItems: Record<string, NavigationItem> = {
      'home': { id: 'home', icon: 'Home', label: 'Home', href: '/', keywords: ['dashboard', 'feed'] },
      'search': { id: 'search', icon: 'Search', label: 'Search', href: '/search', keywords: ['find', 'query'] },
      'new': { id: 'new', icon: 'Plus', label: 'New Page', href: '/new', action: () => router.push(buildNewPageUrl()), keywords: ['create', 'write', 'draft'] },
      'notifications': { id: 'notifications', icon: 'Bell', label: 'Notifications', href: '/notifications', keywords: ['alerts', 'inbox'] },
      'map': { id: 'map', icon: 'Map', label: 'Map', href: '/map', keywords: ['location', 'geo'] },
      'leaderboard': { id: 'leaderboard', icon: 'Trophy', label: 'Leaderboards', href: '/leaderboard', keywords: ['rankings', 'top'] },
      'random-pages': { id: 'random-pages', icon: 'Shuffle', label: 'Random', href: '/random-pages', keywords: ['discover', 'surprise'] },
      'trending-pages': { id: 'trending-pages', icon: 'TrendingUp', label: 'Trending', href: '/trending-pages', keywords: ['popular', 'hot'] },
      'following': { id: 'following', icon: 'Heart', label: 'Following', href: '/following', keywords: ['subscribed', 'feed'] },
      'recents': { id: 'recents', icon: 'Clock', label: 'Recents', href: '/recents', keywords: ['history', 'recent'] },
      'invite': { id: 'invite', icon: 'UserPlus', label: 'Invite Friends', href: '/invite', keywords: ['share', 'referral'] },
      ...(groupsEnabled ? { 'groups': { id: 'groups', icon: 'Users', label: 'Groups', href: '/groups', keywords: ['communities', 'teams'] } } : {}),
      'profile': { id: 'profile', icon: 'User', label: 'Profile', href: user ? `/u/${user.uid}` : '/auth/login', keywords: ['account', 'me'] },
      'settings': { id: 'settings', icon: 'Settings', label: 'Settings', href: '/settings', keywords: ['preferences', 'config'] },
      ...(isUserAdmin ? { 'admin': { id: 'admin', icon: 'Shield', label: 'Admin', href: '/admin', keywords: ['manage', 'dashboard'] } } : {}),
    };

    return sidebarOrder
      .filter(id => allItems[id])
      .map(id => allItems[id]);
  }, [user, router, sidebarOrder, groupsEnabled, isUserAdmin]);
}
