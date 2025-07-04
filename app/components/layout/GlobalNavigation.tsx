"use client";

import React from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { SidebarProvider } from './UnifiedSidebar';
import MobileBottomNav from './MobileBottomNav';
import SidebarLayout from './SidebarLayout';
import UsernameEnforcementModal from '../auth/UsernameEnforcementModal';
import UnverifiedUserBanner from '../utils/UnverifiedUserBanner';

/**
 * GlobalNavigation Component
 * 
 * Provides global navigation elements (mobile toolbar and desktop sidebar)
 * for all authenticated users across the application. The individual components
 * handle their own visibility logic based on the current route.
 */
export default function GlobalNavigation({ children }: { children: React.ReactNode }) {
  const { session, isAuthenticated } = useCurrentAccount();

  // Only render navigation for authenticated users
  if (!isAuthenticated || !session) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      {/* Email verification banner - shows at top for unverified users */}
      <UnverifiedUserBanner />
      <SidebarLayout>
        {children}
      </SidebarLayout>
      {/* Mobile bottom navigation - handles its own visibility logic */}
      <MobileBottomNav />
      {/* Username enforcement modal - shows when user needs to set username */}
      <UsernameEnforcementModal />
    </SidebarProvider>
  );
}
