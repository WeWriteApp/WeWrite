"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { LandingColorProvider } from "./LandingColorContext";
import { LandingBlobs } from "./LandingBlobs";

/**
 * GlobalLandingBlobs
 *
 * Renders the landing page blobs at the root level so they persist
 * across page transitions between landing page and auth pages.
 *
 * Shows blobs on:
 * - Landing page (/) when user is not authenticated
 * - All auth pages (/auth/*)
 *
 * This creates a seamless visual transition between these pages.
 *
 * NOTE: We intentionally do NOT show blobs during loading states.
 * The loading state should be blank/normal to avoid visual flash.
 */
export function GlobalLandingBlobs() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Don't show anything while loading - keep it blank
  if (isLoading) {
    return null;
  }

  // Show blobs on auth pages
  const isAuthPage = pathname?.startsWith("/auth");

  // Show blobs on landing page for logged-out users
  // Also show for unverified users since they'll see the verify-email-pending page
  const isLandingForLoggedOut = pathname === "/" && !isAuthenticated;

  // Show blobs if user exists but is not verified (they're on auth-like flow)
  const isUnverifiedUser = user && !user.emailVerified;

  const shouldShowBlobs = isAuthPage || isLandingForLoggedOut || isUnverifiedUser;

  if (!shouldShowBlobs) {
    return null;
  }

  return (
    <LandingColorProvider>
      <LandingBlobs />
    </LandingColorProvider>
  );
}

export default GlobalLandingBlobs;
