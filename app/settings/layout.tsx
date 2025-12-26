"use client";

/**
 * Settings Layout
 *
 * Uses ResponsiveDrawerLayout for unified mobile/desktop experience:
 * - Mobile: Opens as a bottom drawer with menu navigation
 * - Desktop: Traditional sidebar layout
 *
 * Both use the same content and share the same sections configuration
 * from useSettingsSections hook.
 */

import { useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import UnifiedLoader from "../components/ui/unified-loader";
import SettingsHeader from '../components/settings/SettingsHeader';
import { useSettingsSections } from '../hooks/useSettingsSections';
import { ResponsiveDrawerLayout } from '../components/layout/ResponsiveDrawerLayout';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Use the shared settings sections hook - single source of truth
  const { sections } = useSettingsSections();

  useEffect(() => {
    // Don't redirect while still loading authentication state
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
  }, [isAuthenticated, isLoading, router]);

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

  if (!isAuthenticated) {
    return <UnifiedLoader isLoading={true} message="Loading settings..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <ResponsiveDrawerLayout
      basePath="/settings"
      sections={sections}
      title="Settings"
      headerContent={<SettingsHeader />}
      analyticsId="settings"
      drawerHeight="85vh"
    >
      {children}
    </ResponsiveDrawerLayout>
  );
}
