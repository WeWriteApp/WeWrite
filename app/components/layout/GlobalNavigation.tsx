"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from './DesktopSidebar';

// Using the new unified mobile nav with single drag zone
import MobileBottomNav from './MobileBottomNav';
import FloatingActionButton from './FloatingActionButton';
import SidebarLayout from './SidebarLayout';
import UsernameEnforcementModal from '../auth/UsernameEnforcementModal';
import FinancialHeader from './FinancialHeader';
import UsernameSetupBanner from '../utils/UsernameSetupBanner';
import PWABanner from '../utils/PWABanner';
import EmailVerificationTopBanner from './EmailVerificationTopBanner';
import { TutorialOverlay } from '../onboarding/TutorialOverlay';


/**
 * GlobalNavigation Component
 *
 * Provides global navigation elements (mobile toolbar and desktop sidebar)
 * for all authenticated users across the application. The individual components
 * handle their own visibility logic based on the current route.
 */
export default function GlobalNavigation({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // Track if we've hydrated to avoid SSR/client mismatch
  // On server and during initial hydration, we render only children
  // After hydration, we can safely render navigation elements
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Skip navigation on /welcome pages - show only the landing page content
  const isWelcomePage = pathname?.startsWith('/welcome');

  // During SSR and initial hydration, render only children to avoid mismatch
  // The server doesn't know auth state, so we must wait for client hydration
  if (!isHydrated) {
    return <>{children}</>;
  }

  // Only render navigation for authenticated users (and not on /welcome)
  if (!isAuthenticated || !user || isWelcomePage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop top banner - fixed at very top, pushes all content down */}
      <EmailVerificationTopBanner />

      {/* Floating elements - render outside SidebarLayout to ensure proper viewport positioning */}
      <FinancialHeader />
      <MobileBottomNav />
      <FloatingActionButton />
      <TutorialOverlay />

      <SidebarProvider>
        <SidebarLayout>
          {/* Banner system - inside content flow */}
          <UsernameSetupBanner />
          <PWABanner />
          {children}
        </SidebarLayout>
        {/* Username enforcement modal - shows when user needs to set username */}
        <UsernameEnforcementModal />
      </SidebarProvider>
    </>
  );
}
