"use client";

import { PageLoader } from "./ui/page-loader";

interface AuthRedirectOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function AuthRedirectOverlay({
  isVisible,
  message = "Redirecting to your dashboard..."
}: AuthRedirectOverlayProps) {
  if (!isVisible) return null;

  return <PageLoader message={message} fullScreen={true} />;
}
