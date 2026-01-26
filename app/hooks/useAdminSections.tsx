'use client';

/**
 * useAdminSections Hook
 *
 * Single source of truth for admin menu sections.
 * Used by both mobile drawer and desktop sidebar navigation.
 *
 * ## Adding New Sections
 *
 * When adding new admin sections:
 * 1. Add the section to the ADMIN_SECTIONS array below
 * 2. Icon names MUST exist in app/components/ui/Icon.tsx iconMap
 * 3. Use createIconComponent() wrapper for consistency
 * 4. Run `bun run icons:list` to see all available icons
 * 5. If an icon doesn't exist, add it to Icon.tsx first (see Icon.tsx JSDoc)
 *
 * ## Icon Validation
 *
 * - Icon names are type-checked via the IconName type
 * - If you use an unmapped icon, you'll see "?" in the UI
 * - In development, the console will show available icons and instructions
 * - Browse all icons: https://lucide.dev/icons
 *
 * @example
 * ```tsx
 * {
 *   id: 'my-feature',
 *   title: 'My Feature',
 *   icon: createIconComponent('Video'), // Must exist in Icon.tsx
 *   href: '/admin/my-feature',
 *   description: 'Description of my feature'
 * }
 * ```
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { useAdminData } from '../providers/AdminDataProvider';

/**
 * Creates an icon component wrapper for admin sections
 *
 * @param name - Icon name from IconName type (must exist in Icon.tsx iconMap)
 * @returns React component that renders the icon with standard admin styling
 */
const createIconComponent = (name: IconName) => {
  const IconComponent = ({ className }: { className?: string }) => (
    <Icon name={name} size={20} className={className} />
  );
  IconComponent.displayName = `${name}Icon`;
  return IconComponent;
};

export interface AdminSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  description?: string;
  /** If true, this is a toggle that doesn't navigate anywhere */
  isToggle?: boolean;
  /** Current toggle state if isToggle is true */
  toggleState?: boolean;
  /** Callback for toggle change */
  onToggleChange?: (value: boolean) => void;
  /** Status text to show next to the item */
  statusText?: string;
  /** Whether this is a primary/featured section */
  isPrimary?: boolean;
}

export interface AdminSectionWithStatus extends AdminSection {
  /** React element to render as status indicator (right side of menu item) */
  statusIndicator?: React.ReactNode;
}

// Define admin sections
const ADMIN_SECTIONS: AdminSection[] = [
  // Primary tools at the top
  {
    id: 'product-kpis',
    title: 'Product KPIs',
    icon: createIconComponent('BarChart3'),
    href: '/admin/product-kpis',
    description: 'Analytics, metrics, and platform performance',
    isPrimary: true
  },
  {
    id: 'monthly-financials',
    title: 'Monthly Financials',
    icon: createIconComponent('Calendar'),
    href: '/admin/monthly-financials',
    description: 'Revenue, payouts, and Stripe balance',
    isPrimary: true
  },
  // Management tools
  {
    id: 'users',
    title: 'Users',
    icon: createIconComponent('Users'),
    href: '/admin/users',
    description: 'User management and search'
  },
  {
    id: 'user-activation',
    title: 'User Activation',
    icon: createIconComponent('Flame'),
    href: '/admin/user-activation',
    description: 'Activation matrix and funnel'
  },
  {
    id: 'feature-flags',
    title: 'Feature Flags',
    icon: createIconComponent('Flag'),
    href: '/admin/feature-flags',
    description: 'Manage gated features'
  },
  {
    id: 'writing-ideas',
    title: 'Writing Ideas',
    icon: createIconComponent('FileText'),
    href: '/admin/writing-ideas',
    description: 'Manage new page prompts'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: createIconComponent('Mail'),
    href: '/admin/notifications',
    description: 'Email and push notification settings'
  },
  {
    id: 'background-images',
    title: 'Background Images',
    icon: createIconComponent('Image'),
    href: '/admin/background-images',
    description: 'Default background management'
  },
  {
    id: 'opengraph-images',
    title: 'OpenGraph Images',
    icon: createIconComponent('Share2'),
    href: '/admin/opengraph-images',
    description: 'Social sharing previews'
  },
  {
    id: 'marketing-videos',
    title: 'Marketing Videos',
    icon: createIconComponent('Video'),
    href: '/admin/marketing-videos',
    description: 'Create videos with Remotion'
  },
  // Developer tools
  {
    id: 'system-diagram',
    title: 'System Diagram',
    icon: createIconComponent('Network'),
    href: '/admin/system-diagram',
    description: 'Architecture overview'
  },
  {
    id: 'financial-tests',
    title: 'Financial Tests',
    icon: createIconComponent('DollarSign'),
    href: '/admin/financial-tests',
    description: 'Test earnings and payouts'
  },
  {
    id: 'mobile-onboarding',
    title: 'Mobile Onboarding',
    icon: createIconComponent('TabletSmartphone'),
    href: '/admin/mobile-onboarding',
    description: 'Preview iOS/Android onboarding'
  },
  {
    id: 'onboarding-tutorial',
    title: 'Onboarding Tutorial',
    icon: createIconComponent('BookOpen'),
    href: '/admin/onboarding-tutorial',
    description: 'Test guided tutorial'
  },
  {
    id: 'print-preview',
    title: 'Print Preview',
    icon: createIconComponent('Printer'),
    href: '/admin/print-preview',
    description: 'Customize print styling'
  }
];

// Testing toggle sections (these don't have hrefs, they're toggles)
export interface AdminToggle {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  storageKey: string;
  eventName?: string;
}

export const ADMIN_TOGGLES: AdminToggle[] = [
  {
    id: 'pwa-banner',
    title: 'PWA Banner',
    icon: createIconComponent('Download'),
    description: 'Show PWA installation banner',
    storageKey: 'wewrite_admin_pwa_banner'
  },
  {
    id: 'email-unverified',
    title: 'Email Unverified',
    icon: createIconComponent('MailWarning'),
    description: 'Simulate unverified email state',
    storageKey: 'wewrite_admin_email_banner_override',
    eventName: 'bannerOverrideChange'
  },
  {
    id: 'no-subscription',
    title: 'Force Paywalls',
    icon: createIconComponent('Lock'),
    description: 'Force all paywalls to show',
    storageKey: 'wewrite_admin_no_subscription_mode',
    eventName: 'adminPaywallOverrideChange'
  },
  {
    id: 'fake-earnings',
    title: 'Fake Earnings',
    icon: createIconComponent('Coins'),
    description: 'Show mock earnings data',
    storageKey: 'wewrite_admin_earnings_testing_mode',
    eventName: 'adminEarningsTestingChange'
  }
];

export function useAdminSections(): {
  sections: AdminSectionWithStatus[];
  toggles: AdminToggle[];
  usersCount: number | null;
  writingIdeasCount: number | null;
  isLoading: boolean;
} {
  const { adminFetch, isHydrated } = useAdminData();
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [writingIdeasCount, setWritingIdeasCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load counts for status indicators
  useEffect(() => {
    if (!isHydrated) return;

    const loadCounts = async () => {
      setIsLoading(true);
      try {
        // Load user count
        const usersRes = await adminFetch('/api/admin/users?countOnly=true');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsersCount(usersData.total ?? null);
        }

        // Load writing ideas count
        const ideasRes = await adminFetch('/api/admin/writing-ideas');
        if (ideasRes.ok) {
          const ideasData = await ideasRes.json();
          setWritingIdeasCount(ideasData.data?.total ?? 0);
        }
      } catch (error) {
        console.error('Error loading admin section counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCounts();
  }, [isHydrated, adminFetch]);

  const sections = useMemo(() => {
    return ADMIN_SECTIONS.map((section): AdminSectionWithStatus => {
      let statusIndicator: React.ReactNode = null;

      // Add status indicators for sections with counts
      if (section.id === 'users' && usersCount !== null) {
        statusIndicator = (
          <span className="text-xs text-muted-foreground">
            {usersCount} users
          </span>
        );
      } else if (section.id === 'writing-ideas' && writingIdeasCount !== null) {
        statusIndicator = (
          <span className="text-xs text-muted-foreground">
            {writingIdeasCount} ideas
          </span>
        );
      }

      return {
        ...section,
        statusIndicator
      };
    });
  }, [usersCount, writingIdeasCount]);

  return {
    sections,
    toggles: ADMIN_TOGGLES,
    usersCount,
    writingIdeasCount,
    isLoading
  };
}
