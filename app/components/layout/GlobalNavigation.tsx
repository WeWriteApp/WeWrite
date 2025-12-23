"use client";

import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from './UnifiedSidebar';

// Using the new unified mobile nav with single drag zone
import MobileBottomNavUnified from './MobileBottomNavUnified';
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
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Skip navigation on /welcome pages - show only the landing page content
  const isWelcomePage = pathname?.startsWith('/welcome');

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
      <MobileBottomNavUnified />
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
