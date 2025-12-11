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
 */
export function GlobalLandingBlobs() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show blobs on auth pages
  const isAuthPage = pathname?.startsWith("/auth");

  // Show blobs on landing page for logged-out users
  // Also show for unverified users since they'll see the verify-email-pending page
  const isLandingForLoggedOut = pathname === "/" && !isAuthenticated;

  // Show blobs while loading (to prevent flash)
  const showWhileLoading = isLoading && (pathname === "/" || isAuthPage);

  // Show blobs if user exists but is not verified (they're on auth-like flow)
  const isUnverifiedUser = user && !user.emailVerified;

  const shouldShowBlobs = isAuthPage || isLandingForLoggedOut || showWhileLoading || isUnverifiedUser;

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
