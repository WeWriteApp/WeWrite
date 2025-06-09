"use client";

import { useAuth } from "../../providers/AuthProvider";

export default function AuthNav() {
  const { user } = useAuth();

  // AuthNav is now simplified - desktop menu functionality moved to UnifiedSidebar
  // This component can be used for future auth-specific navigation if needed
  return null;
}