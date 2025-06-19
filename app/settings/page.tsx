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
  const tokenSystemEnabled = useFeatureFlag('token_system', user?.email, user?.uid);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [user, router]);

  const settingsSections: SettingsSection[] = [
    {
      id: 'profile',
      title: 'Profile',
      icon: User,
      href: '/settings/profile'
    },
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
      id: 'deleted',
      title: 'Recently deleted',
      icon: Trash2,
      href: '/settings/deleted'
    },
    {
      id: 'account',
      title: 'Account',
      icon: SettingsIcon,
      href: '/settings/account'
    }
  ];

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

      {/* Desktop Welcome Content */}
      <div className="hidden lg:block p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Settings</h2>
          <p className="text-muted-foreground mb-8">
            Manage your account and preferences using the sidebar navigation.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            {availableSections.slice(0, 4).map((section) => {
              const IconComponent = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.href)}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-center"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mx-auto mb-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{section.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
