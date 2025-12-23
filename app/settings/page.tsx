'use client';

import { useAuth } from '../providers/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { WarningDot } from '../components/ui/warning-dot';
import { useSettingsSections } from '../hooks/useSettingsSections';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getAnalyticsService } from '../utils/analytics-service';
import { SETTINGS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

export default function SettingsIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { hasActiveSubscription } = useSubscription();

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
    const checkAndRedirect = () => {
      if (typeof window !== 'undefined') {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop && sections.length > 0) {
          router.push(sections[0].href);
        }
      }
    };

    // Check immediately
    checkAndRedirect();

    // Also check on resize to handle window size changes
    const handleResize = () => checkAndRedirect();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [user, router, sections]);

  const handleSectionClick = (href: string, sectionId: string) => {
    // Track section click
    const analytics = getAnalyticsService();
    analytics.trackEvent({
      category: EVENT_CATEGORIES.SETTINGS,
      action: SETTINGS_EVENTS.SETTINGS_SECTION_CLICKED,
      section_id: sectionId,
      section_href: href
    });
    router.push(href);
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      {/* Mobile Settings List */}
      <div className="lg:hidden p-4">
        <div className="wewrite-card wewrite-card-no-padding divide-y divide-border overflow-hidden">
          {sections.map((section) => {
            const IconComponent = section.icon;

            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => handleSectionClick(section.href, section.id)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left nav-hover-state nav-active-state transition-colors select-none"
                >
                  <div className="flex items-center">
                    <IconComponent className="h-5 w-5 mr-3 text-foreground" />
                    <span className="font-medium">{section.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status indicator from shared hook */}
                    {section.statusIndicator}
                    <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
                  </div>
                </button>
                {section.showWarning && (
                  <WarningDot
                    variant={section.warningVariant}
                    size="sm"
                    position="top-right"
                    offset={{ top: '12px', right: '12px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop should never see this page - it redirects automatically */}
    </div>
  );
}
