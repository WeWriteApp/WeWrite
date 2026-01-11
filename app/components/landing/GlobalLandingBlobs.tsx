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
  const { isAuthenticated, isLoading } = useAuth();

  // Don't show anything while loading - keep it blank
  if (isLoading) {
    return null;
  }

  // Show blobs on auth pages
  const isAuthPage = pathname?.startsWith("/auth");

  // Show blobs on welcome/landing pages (including /welcome and /welcome/*)
  const isWelcomePage = pathname === "/welcome" || pathname?.startsWith("/welcome/");

  // Show blobs on root page for logged-out users (they'll be redirected to /welcome)
  const isRootForLoggedOut = pathname === "/" && !isAuthenticated;

  // Only show blobs on landing/auth pages - NOT for logged-in users on other pages
  const shouldShowBlobs = isAuthPage || isWelcomePage || isRootForLoggedOut;

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
