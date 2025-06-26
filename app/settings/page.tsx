'use client';

import { useAuth } from "../providers/AuthProvider";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  User,
  CreditCard,
  Coins,
  Settings as SettingsIcon,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { useFeatureFlag } from '../utils/feature-flags';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  requiresPayments?: boolean;
  requiresTokenSystem?: boolean;
}

export default function SettingsIndexPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Check feature flags with proper user ID for real-time updates
  const paymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);
  // Token system is enabled by payments feature flag
  const tokenSystemEnabled = paymentsEnabled;

  const settingsSections: SettingsSection[] = [
    {
      id: 'subscription',
      title: 'Subscription',
      icon: CreditCard,
      href: '/settings/subscription',
      requiresPayments: true,
      requiresTokenSystem: true
    },
    {
      id: 'earnings',
      title: 'Earnings',
      icon: Coins,
      href: '/settings/earnings',
      requiresPayments: true
    },
    {
      id: 'profile',
      title: 'Profile',
      icon: User,
      href: '/settings/profile'
    },
    {
      id: 'deleted',
      title: 'Recently deleted',
      icon: Trash2,
      href: '/settings/deleted'
    },
    {
      id: 'advanced',
      title: 'Advanced',
      icon: SettingsIcon,
      href: '/settings/advanced'
    }
  ];

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Filter sections based on feature flags to get available sections
    const availableSections = settingsSections.filter(section => {
      if (section.requiresPayments && !paymentsEnabled) {
        return false;
      }
      if (section.requiresTokenSystem && !tokenSystemEnabled) {
        return false;
      }
      return true;
    });

    // On desktop, always redirect to first available settings page
    // Use a more robust check for desktop vs mobile
    const checkAndRedirect = () => {
      if (typeof window !== 'undefined') {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop && availableSections.length > 0) {
          router.push(availableSections[0].href);
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
  }, [user, router, paymentsEnabled, tokenSystemEnabled]);

  // Filter sections based on feature flags
  const availableSections = settingsSections.filter(section => {
    if (section.requiresPayments && !paymentsEnabled) {
      return false;
    }
    if (section.requiresTokenSystem && !tokenSystemEnabled) {
      return false;
    }
    return true;
  });

  const handleSectionClick = (href: string) => {
    router.push(href);
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      {/* Mobile Settings List */}
      <div className="lg:hidden">
        <div className="divide-y divide-border">
          {availableSections.map((section) => {
            const IconComponent = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.href)}
                className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 mr-3">
                    <IconComponent className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">{section.title}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop should never see this page - it redirects automatically */}
    </div>
  );
}
