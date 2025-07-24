"use client";

import UnifiedLoader from "../ui/unified-loader";

interface AuthRedirectOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function AuthRedirectOverlay({
  isVisible,
  message = "Redirecting to your dashboard..."
}: AuthRedirectOverlayProps) {
  if (!isVisible) return null;

  return <UnifiedLoader isLoading={true} message={message} fullScreen={true} />;
}