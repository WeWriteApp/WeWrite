'use client';

/**
 * Settings Index Page
 *
 * - On desktop: Redirects to the first settings section (sidebar needs a selected section)
 * - On mobile: Returns null (MobilePageNav in the layout handles the menu)
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
    if (isDesktop && sections.length > 0) {
      router.push(sections[0].href);
    }
  }, [user, router, sections, isDesktop]);

  if (!user) {
    return null;
  }

  // On mobile, the layout's MobilePageNav shows the menu
  // On desktop, we redirect to the first section (handled in useEffect)
  return null;
}
