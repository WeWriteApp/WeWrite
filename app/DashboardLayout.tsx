"use client";

import { ReactNode, useContext } from "react";
import { Loader } from "./components/utils/Loader";
import { useTheme } from "./providers/ThemeProvider";
import { DataContext } from "./providers/DataProvider";

/**
 * Dashboard layout props interface
 */
interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * @deprecated DashboardLayout is deprecated and should not be used.
 *
 * IMPORTANT: This component has been deprecated to prevent layout regressions.
 * The modern layout structure is handled by ClientLayout.js which includes:
 * - SidebarProvider
 * - SidebarLayout
 * - UnifiedSidebar (desktop)
 * - MobileBottomNav (mobile)
 *
 * Instead of using DashboardLayout, pages should return their content directly
 * and rely on the ClientLayout structure for proper sidebar and navigation.
 *
 * For authenticated users: Use React.Fragment or return content directly
 * For public pages: Use PublicLayout if needed
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  // Log warning when this deprecated component is used
  console.warn(
    '🚨 DEPRECATED: DashboardLayout is deprecated and causes layout regressions. ' +
    'Remove DashboardLayout wrapper and return content directly. ' +
    'The modern layout is handled by ClientLayout.js automatically.'
  );

  const { theme } = useTheme();
  const { loading } = useContext(DataContext);

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <Loader show={loading} />
      <div className="flex flex-col relative">
        {/* Deprecated layout warning banner */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 mx-4 mt-4">
            <strong>⚠️ DEPRECATED LAYOUT:</strong> This page is using the deprecated DashboardLayout.
            Remove the DashboardLayout wrapper to use the modern sidebar layout.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}