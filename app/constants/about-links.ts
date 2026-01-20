/**
 * About Page Links Configuration
 *
 * Single source of truth for all links shown in the About settings section.
 * Used by both desktop (page.tsx) and mobile (AboutContent.tsx) views.
 */

import { getSocialUrl } from '@/config/social-links';

export interface AboutLinkConfig {
  id: string;
  href: string;
  label: string;
  icon: string;
  external?: boolean;
  /** If true, this link triggers a modal/callback instead of navigation */
  isAction?: boolean;
  /** For in-drawer navigation on mobile (e.g., 'about/follow-us') */
  drawerPath?: string;
  /** Whether to show chevron (for nested navigation) */
  hasChevron?: boolean;
}

/**
 * All links shown in the About section
 * Order matters - they appear in this order in the UI
 */
export const ABOUT_LINKS: AboutLinkConfig[] = [
  {
    id: 'roadmap',
    href: '/zRNwhNgIEfLFo050nyAT',
    label: 'Feature Roadmap',
    icon: 'Map',
  },
  {
    id: 'about-us',
    href: '/sUASL4gNdCMVHkr7Qzty',
    label: 'About us',
    icon: 'Info',
  },
  {
    id: 'feedback',
    href: '#',
    label: 'Feedback',
    icon: 'MessageSquare',
    isAction: true,
  },
  {
    id: 'credits',
    href: '/credits',
    label: 'Credits',
    icon: 'Heart',
  },
  {
    id: 'privacy',
    href: '/privacy',
    label: 'Privacy',
    icon: 'Shield',
  },
  {
    id: 'terms',
    href: '/terms',
    label: 'Terms',
    icon: 'FileText',
  },
  {
    id: 'email-support',
    href: 'mailto:support@getwewrite.app',
    label: 'Email support',
    icon: 'Mail',
    external: true,
  },
  {
    id: 'follow-us',
    href: '/settings/about/follow-us',
    label: 'Follow us',
    icon: 'Users',
    hasChevron: true,
    drawerPath: 'about/follow-us',
  },
  {
    id: 'source-code',
    href: getSocialUrl('github') || 'https://github.com/WeWriteApp/WeWrite',
    label: 'Source code',
    icon: 'Code',
    external: true,
  },
  {
    id: 'design-system',
    href: '/design-system',
    label: 'Design System',
    icon: 'Palette',
  },
];
