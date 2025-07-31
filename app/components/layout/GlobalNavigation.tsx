"use client";

import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { SidebarProvider } from './UnifiedSidebar';
import MobileBottomNav from './MobileBottomNav';
import MobileFloatingActionButton from './MobileFloatingActionButton';
import SidebarLayout from './SidebarLayout';
import UsernameEnforcementModal from '../auth/UsernameEnforcementModal';


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
    <SidebarProvider>
      <SidebarLayout>
        {children}
      </SidebarLayout>
      {/* Mobile bottom navigation - handles its own visibility logic */}
      <MobileBottomNav />
      {/* Mobile floating action button - shows on NavPages where mobile toolbar is visible */}
      <MobileFloatingActionButton />
      {/* Username enforcement modal - shows when user needs to set username */}
      <UsernameEnforcementModal />
    </SidebarProvider>
  );
}
