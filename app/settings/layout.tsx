"use client";

import { useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { PageLoader } from "../components/ui/page-loader";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return <PageLoader message="Loading settings..." />;
  }

  // Just render children without any container UI
  return <>{children}</>;
}