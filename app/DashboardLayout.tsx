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
 * DashboardLayout component that provides the main layout structure
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { theme } = useTheme();
  const { loading } = useContext(DataContext);

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <Loader show={loading} />
      <div className="flex flex-col relative">
        {children}
      </div>
    </div>
  );
}