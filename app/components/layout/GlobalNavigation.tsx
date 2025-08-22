"use client";

import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { SidebarProvider } from './UnifiedSidebar';

import MobileBottomNav from './MobileBottomNav';
import FloatingActionButton from './FloatingActionButton';
import SidebarLayout from './SidebarLayout';
import UsernameEnforcementModal from '../auth/UsernameEnforcementModal';
import FloatingFinancialHeader from './FloatingFinancialHeader';


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
      <SidebarProvider>
        {/* Floating financial header - shows on all logged-in pages */}
        <FloatingFinancialHeader />
        <SidebarLayout>
          {children}
        </SidebarLayout>
        {/* Mobile bottom navigation - properly implemented */}
        <MobileBottomNav />
        {/* Floating action button - shows on appropriate pages */}
        <FloatingActionButton />
        {/* Username enforcement modal - shows when user needs to set username */}
        <UsernameEnforcementModal />
      </SidebarProvider>

    </>
  );
}
