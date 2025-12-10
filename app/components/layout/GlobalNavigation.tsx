"use client";

import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { SidebarProvider } from './UnifiedSidebar';

// Using the new unified mobile nav with single drag zone
import MobileBottomNavUnified from './MobileBottomNavUnified';
import FloatingActionButton from './FloatingActionButton';
import SidebarLayout from './SidebarLayout';
import UsernameEnforcementModal from '../auth/UsernameEnforcementModal';
import FloatingFinancialHeader from './FloatingFinancialHeader';
import VerifyEmailBanner from '../utils/VerifyEmailBanner';
import UsernameSetupBanner from '../utils/UsernameSetupBanner';
import PWABanner from '../utils/PWABanner';


/**
 * GlobalNavigation Component
 * 
 * Provides global navigation elements (mobile toolbar and desktop sidebar)
 * for all authenticated users across the application. The individual components
 * handle their own visibility logic based on the current route.
 */
export default function GlobalNavigation({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();



  // Only render navigation for authenticated users
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Floating elements - render outside SidebarLayout to ensure proper viewport positioning */}
      <FloatingFinancialHeader />
      <MobileBottomNavUnified />
      <FloatingActionButton />

      <SidebarProvider>
        <SidebarLayout>
          {/* Banner system - inside content flow (priority: email > username > PWA) */}
          <VerifyEmailBanner />
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
