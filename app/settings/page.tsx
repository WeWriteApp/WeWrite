'use client';

/**
 * Settings Index Page
 *
 * This page is a placeholder that:
 * - On desktop: Redirects to the first settings section (since desktop shows sidebar)
 * - On mobile: Renders nothing (the layout handles showing the drawer with menu)
 *
 * The actual settings menu is now rendered by the layout's drawer on mobile,
 * using path-based navigation for proper analytics tracking and deep linking.
 */

import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSettingsSections } from '../hooks/useSettingsSections';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useMediaQuery } from '../hooks/use-media-query';
import { getAnalyticsService } from '../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

export default function SettingsIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { hasActiveSubscription } = useSubscription();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Use the shared settings sections hook - single source of truth
  const { sections } = useSettingsSections();

  // Track settings page view
  useEffect(() => {
    if (user) {
      const analytics = getAnalyticsService();
      analytics.trackEvent({
        category: EVENT_CATEGORIES.SETTINGS,
        action: SETTINGS_EVENTS.SETTINGS_PAGE_VIEWED,
        has_subscription: hasActiveSubscription
      });
    }
  }, [user, hasActiveSubscription]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // On desktop, always redirect to first available settings page
    // The sidebar needs a selected section to display
    if (isDesktop && sections.length > 0) {
      router.push(sections[0].href);
    }

    // On mobile, do nothing - the layout's drawer shows the menu
  }, [user, router, sections, isDesktop]);

  if (!user) {
    return null;
  }

  // On mobile, render nothing - the layout's drawer handles showing the menu
  // On desktop, we'll redirect to the first section (handled in useEffect)
  return null;
}
