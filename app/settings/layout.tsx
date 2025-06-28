"use client";

import { useContext, useEffect } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext } from "../providers/AuthProvider";
import { PageLoader } from "../components/ui/page-loader";
import { Button } from "../components/ui/button";
import {
  ChevronLeft,
  User,
  CreditCard,
  Coins,
  Settings as SettingsIcon,
  Trash2
} from 'lucide-react';
import { useFeatureFlag } from '../utils/feature-flags';
import { cn } from '../lib/utils';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  requiresPayments?: boolean;
}

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  // Check payments feature flag with proper user ID for real-time updates
  const paymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return <PageLoader message="Loading settings..." />;
  }

  if (!user) {
    return null;
  }

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
      requiresPayments: true
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
      id: 'advanced',
      title: 'Advanced',
      icon: SettingsIcon,
      href: '/settings/advanced'
    }
  ];

  // Filter sections based on feature flags
  const availableSections = settingsSections.filter(section => {
    if (section.requiresPayments && !paymentsEnabled) {
      return false;
    }
    return true;
  });

  const handleSectionClick = (href: string) => {
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header - Only show on main settings page */}
      {pathname === '/settings' && (
        <div className="lg:hidden">
          <div className="flex items-center px-4 py-3 border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="mr-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>
      )}

      <div className="lg:flex">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-border lg:bg-background lg:z-10">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center px-6 py-4 border-b border-border">
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>

            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {availableSections.map((section) => {
                  const IconComponent = section.icon;
                  const isActive = pathname === section.href ||
                    (pathname.startsWith(section.href + '/') && section.href !== '/settings');

                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionClick(section.href)}
                      className={cn(
                        "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <IconComponent className={cn(
                        "h-5 w-5 mr-3",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                      {section.title}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:ml-64 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}