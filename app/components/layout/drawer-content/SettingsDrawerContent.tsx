'use client';

/**
 * SettingsDrawerContent
 *
 * Content for the global settings drawer.
 * - isMenuView=true: Shows the settings menu list
 * - isMenuView=false: Shows the content for the specified subPath
 */

import React, { Suspense, lazy } from 'react';
import { useGlobalDrawer } from '../../../providers/GlobalDrawerProvider';
import { useSettingsSections } from '../../../hooks/useSettingsSections';
import { Icon } from '@/components/ui/Icon';

// Lazy load individual settings pages content
const ProfileContent = lazy(() => import('../../settings/drawer-content/ProfileContent'));
const AppearanceContent = lazy(() => import('../../settings/drawer-content/AppearanceContent'));
const NotificationsContent = lazy(() => import('../../settings/drawer-content/NotificationsContent'));
const SecurityContent = lazy(() => import('../../settings/drawer-content/SecurityContent'));
const EarningsContent = lazy(() => import('../../settings/drawer-content/EarningsContent'));
const SpendContent = lazy(() => import('../../settings/drawer-content/SpendContent'));
const FundAccountContent = lazy(() => import('../../settings/drawer-content/FundAccountContent'));
const EmailPreferencesContent = lazy(() => import('../../settings/drawer-content/EmailPreferencesContent'));
const AdvancedContent = lazy(() => import('../../settings/drawer-content/AdvancedContent'));
const DeletedContent = lazy(() => import('../../settings/drawer-content/DeletedContent'));
const AboutContent = lazy(() => import('../../settings/drawer-content/AboutContent'));
const FollowUsContent = lazy(() => import('../../settings/drawer-content/FollowUsContent'));

interface SettingsDrawerContentProps {
  isMenuView: boolean;
  subPath?: string | null;
}

/**
 * Menu list for settings drawer
 */
function SettingsMenuList() {
  const { sections } = useSettingsSections();
  const { navigateInDrawer } = useGlobalDrawer();

  return (
    <div className="h-full overflow-y-auto divide-y divide-border pb-safe">
      {sections.map((section) => {
        const IconComponent = section.icon;
        // Extract subPath from href (e.g., '/settings/profile' -> 'profile')
        const subPath = section.href.replace('/settings/', '').replace('/settings', '');

        return (
          <button
            key={section.id}
            onClick={() => navigateInDrawer(`settings/${subPath || section.id}`)}
            className="w-full flex items-center justify-between px-4 py-4 text-left nav-hover-state nav-active-state transition-colors select-none"
          >
            <div className="flex items-center">
              <IconComponent className="h-5 w-5 mr-3 text-foreground" />
              <span className="font-medium">{section.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {section.statusIndicator}
              <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Loading fallback
 */
function ContentLoading() {
  return (
    <div className="flex items-center justify-center h-32">
      <Icon name="Loader" className="text-muted-foreground" size={20} />
    </div>
  );
}

/**
 * Render the content for a specific settings sub-path
 */
function SettingsSubContent({ subPath }: { subPath: string }) {
  // Parse subPath for query parameters (e.g., 'fund-account?topoff=true')
  const [basePath, queryString] = subPath.split('?');
  const queryParams = new URLSearchParams(queryString || '');

  // Map subPath to component
  const contentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
    'profile': ProfileContent,
    'appearance': AppearanceContent,
    'notifications': NotificationsContent,
    'security': SecurityContent,
    'earnings': EarningsContent,
    'spend': SpendContent,
    'fund-account': FundAccountContent,
    'email-preferences': EmailPreferencesContent,
    'advanced': AdvancedContent,
    'deleted': DeletedContent,
    'about': AboutContent,
    'about/follow-us': FollowUsContent,
  };

  const ContentComponent = contentMap[basePath];

  if (!ContentComponent) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Content not found for: {basePath}</p>
      </div>
    );
  }

  // Pass topoff prop to FundAccountContent
  const extraProps: Record<string, any> = {};
  if (basePath === 'fund-account') {
    extraProps.topoff = queryParams.get('topoff') === 'true';
  }

  return (
    <Suspense fallback={<ContentLoading />}>
      <ContentComponent {...extraProps} />
    </Suspense>
  );
}

export default function SettingsDrawerContent({ isMenuView, subPath }: SettingsDrawerContentProps) {
  if (isMenuView) {
    return <SettingsMenuList />;
  }

  if (!subPath) {
    return null;
  }

  return <SettingsSubContent subPath={subPath} />;
}
