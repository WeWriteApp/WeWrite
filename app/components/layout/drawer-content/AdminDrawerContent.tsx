'use client';

/**
 * AdminDrawerContent
 *
 * Content for the global admin drawer.
 * - isMenuView=true: Shows the admin menu list
 * - isMenuView=false: Shows the content for the specified subPath
 *
 * Note: This component wraps content with AdminDataProvider since it renders
 * outside the admin layout hierarchy.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useGlobalDrawer } from '../../../providers/GlobalDrawerProvider';
import { AdminDataProvider, useAdminData } from '../../../providers/AdminDataProvider';
import { useAdminSections, ADMIN_TOGGLES } from '../../../hooks/useAdminSections';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '../../ui/switch';

// Lazy load admin page components for drawer display
const AdminPages: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Root admin page
  '': lazy(() => import('../../../admin/page')),
  // Sub-pages
  'users': lazy(() => import('../../../admin/users/page')),
  'monthly-financials': lazy(() => import('../../../admin/monthly-financials/page')),
  'product-kpis': lazy(() => import('../../../admin/product-kpis/page')),
  'broadcast': lazy(() => import('../../../admin/broadcast/page')),
  'notifications': lazy(() => import('../../../admin/notifications/page')),
  'feature-flags': lazy(() => import('../../../admin/feature-flags/page')),
  'background-images': lazy(() => import('../../../admin/background-images/page')),
  'writing-ideas': lazy(() => import('../../../admin/writing-ideas/page')),
  'onboarding-tutorial': lazy(() => import('../../../admin/onboarding-tutorial/page')),
  'mobile-onboarding': lazy(() => import('../../../admin/mobile-onboarding/page')),
  'opengraph-images': lazy(() => import('../../../admin/opengraph-images/page')),
  'design-system': lazy(() => import('../../../admin/design-system/page')),
  'system-diagram': lazy(() => import('../../../admin/system-diagram/page')),
  'emails': lazy(() => import('../../../admin/emails/page')),
  'payout-validation': lazy(() => import('../../../admin/payout-validation/page')),
  'financial-tests': lazy(() => import('../../../admin/financial-tests/page')),
  'print-preview': lazy(() => import('../../../admin/print-preview/page')),
};

/**
 * Loading fallback for admin pages
 */
function AdminPageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Icon name="Loader" className="text-muted-foreground" size={24} />
    </div>
  );
}

interface AdminDrawerContentProps {
  isMenuView: boolean;
  subPath?: string | null;
}

/**
 * Data source toggle for mobile drawer
 */
function MobileDataSourceToggle() {
  const { dataSource, setDataSource, isProduction, isHydrated } = useAdminData();

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Icon name="Database" size={20} className="text-muted-foreground" />
          <span className="font-medium text-sm">Data Source</span>
        </div>
        <Icon name="Loader" className="text-muted-foreground" size={16} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <Icon
          name="Database"
          size={20}
          className={isProduction ? "text-green-500" : "text-yellow-500"}
        />
        <span className="font-medium text-sm">Data Source</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${!isProduction ? 'font-medium' : 'text-muted-foreground'}`}>
          DEV
        </span>
        <Switch
          checked={isProduction}
          onCheckedChange={(checked) => setDataSource(checked ? 'production' : 'dev')}
        />
        <span className={`text-xs ${isProduction ? 'font-medium' : 'text-muted-foreground'}`}>
          PROD
        </span>
      </div>
    </div>
  );
}

/**
 * Menu list for admin drawer
 */
function AdminMenuList() {
  const { sections, toggles } = useAdminSections();
  const { navigateInDrawer } = useGlobalDrawer();

  // Toggle states
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const states: Record<string, boolean> = {};
      toggles.forEach(toggle => {
        states[toggle.id] = localStorage.getItem(toggle.storageKey) === 'true';
      });
      setToggleStates(states);
    }
  }, [toggles]);

  const handleToggleChange = (toggle: typeof ADMIN_TOGGLES[0], value: boolean) => {
    setToggleStates(prev => ({ ...prev, [toggle.id]: value }));
    if (typeof window !== 'undefined') {
      if (value) {
        localStorage.setItem(toggle.storageKey, 'true');
      } else {
        localStorage.removeItem(toggle.storageKey);
      }
      if (toggle.eventName) {
        window.dispatchEvent(new CustomEvent(toggle.eventName));
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto pb-safe">
      {/* Data Source Toggle at the top */}
      <MobileDataSourceToggle />

      {/* Primary sections */}
      <div className="divide-y divide-border">
        {sections.filter(s => s.isPrimary).map((section) => {
          const IconComponent = section.icon;
          // Extract subPath from href (e.g., '/admin/users' -> 'users')
          const subPath = section.href.replace('/admin/', '').replace('/admin', '');

          return (
            <button
              key={section.id}
              onClick={() => navigateInDrawer(subPath || section.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left nav-hover-state nav-active-state transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <IconComponent className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{section.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {section.statusIndicator}
                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Regular sections */}
      <div className="divide-y divide-border border-t border-border">
        {sections.filter(s => !s.isPrimary).map((section) => {
          const IconComponent = section.icon;
          const subPath = section.href.replace('/admin/', '').replace('/admin', '');

          return (
            <button
              key={section.id}
              onClick={() => navigateInDrawer(subPath || section.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left nav-hover-state nav-active-state transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <IconComponent className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">{section.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {section.statusIndicator}
                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Testing Toggles */}
      <div className="border-t border-border mt-4 pt-2">
        <div className="px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Testing Tools</span>
        </div>
        <div className="divide-y divide-border">
          {toggles.map((toggle) => {
            const IconComponent = toggle.icon;
            return (
              <div key={toggle.id} className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">{toggle.title}</span>
                </div>
                <Switch
                  checked={toggleStates[toggle.id] || false}
                  onCheckedChange={(value) => handleToggleChange(toggle, value)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Admin sub-content - dynamically loads the actual admin page component
 * Handles nested paths like 'users/abc123' by extracting the base page and passing full path
 */
function AdminSubContent({ subPath }: { subPath: string }) {
  // Extract the base page from paths like 'users/abc123' -> 'users'
  const pathParts = subPath.split('/');
  const basePage = pathParts[0];

  const PageComponent = AdminPages[basePage];

  if (!PageComponent) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-center">
          Admin page not found: <span className="font-medium">{subPath}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mobile-admin-page">
      <Suspense fallback={<AdminPageLoadingFallback />}>
        {/* Pass the full subPath so pages can handle nested navigation */}
        <PageComponent drawerSubPath={subPath} />
      </Suspense>
    </div>
  );
}

function AdminDrawerContentInner({ isMenuView, subPath }: AdminDrawerContentProps) {
  if (isMenuView) {
    return <AdminMenuList />;
  }

  if (!subPath) {
    return null;
  }

  return <AdminSubContent subPath={subPath} />;
}

// Wrap with AdminDataProvider since this renders outside admin layout
export default function AdminDrawerContent(props: AdminDrawerContentProps) {
  return (
    <AdminDataProvider>
      <AdminDrawerContentInner {...props} />
    </AdminDataProvider>
  );
}
