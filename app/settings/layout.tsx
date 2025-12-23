"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import UnifiedLoader from "../components/ui/unified-loader";
import SettingsHeader from '../components/settings/SettingsHeader';
import { cn } from '../lib/utils';
import { WarningDot } from '../components/ui/warning-dot';
import { useSettingsSections } from '../hooks/useSettingsSections';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Use the shared settings sections hook - single source of truth
  const { sections } = useSettingsSections();

  useEffect(() => {
    console.log('🎯 Settings Layout: Auth check', {
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userUid: user?.uid
    });

    // Don't redirect while still loading authentication state
    if (isLoading) {
      console.log('🎯 Settings Layout: Still loading authentication state, not redirecting');
      return;
    }

    if (!isAuthenticated) {
      console.log('🎯 Settings Layout: Redirecting to login because not authenticated');
      router.push('/auth/login');
      return;
    }
  }, [isAuthenticated, isLoading, router, user]);

  if (!isAuthenticated) {
    return <UnifiedLoader isLoading={true} message="Loading settings..." />;
  }

  if (!user) {
    return null;
  }

  const handleSectionClick = (href: string) => {
    router.push(href);
  };

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader" size={32} className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        // Account for any top banners (email verification, PWA, etc.)
        paddingTop: 'var(--email-banner-height, 0px)',
      }}
    >
      {/* Settings Header - handles mobile/desktop logic */}
      <SettingsHeader />

      <div className="lg:flex h-[calc(100vh-3.5rem)]">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden lg:block lg:w-64 lg:border-r-only">
          <div className="flex flex-col h-full">
            <nav className="flex-1 px-3 py-4">
              <div className="space-y-1">
                {sections.map((section) => {
                  const IconComponent = section.icon;
                  const isActive = pathname === section.href ||
                    (pathname.startsWith(section.href + '/') && section.href !== '/settings');

                  return (
                    <div key={section.id} className="relative">
                      <button
                        onClick={() => handleSectionClick(section.href)}
                        className={cn(
                          "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors select-none",
                          isActive
                            ? "nav-selected-state text-foreground"
                            : "text-foreground nav-hover-state nav-active-state hover:text-foreground"
                        )}
                      >
                        <IconComponent className={cn(
                          "h-5 w-5 mr-3",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className="flex-1 text-left">{section.title}</span>

                        {/* Status indicator from shared hook */}
                        {section.statusIndicator}
                      </button>
                      {section.showWarning && (
                        <WarningDot
                          variant={section.warningVariant}
                          size="sm"
                          position="top-right"
                          offset={{ top: '8px', right: '8px' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>

        {/* Main Content Area - Remove excessive left margin, content is already in safe zone */}
        <div className="flex-1 overflow-auto pb-20 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
