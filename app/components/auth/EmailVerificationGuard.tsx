"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

/**
 * EmailVerificationGuard
 *
 * Wraps protected content and redirects unverified users to the email
 * verification pending page. Use this component around any content
 * that should only be accessible to verified users.
 *
 * Usage:
 * ```tsx
 * <EmailVerificationGuard>
 *   <ProtectedContent />
 * </EmailVerificationGuard>
 * ```
 */
export function EmailVerificationGuard({ children }: EmailVerificationGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Only redirect after auth state is loaded
    if (!isLoading && user && !user.emailVerified) {
      router.push("/auth/verify-email-pending");
    }
  }, [user, isLoading, router]);

  // While loading or if user is unverified, don't render children
  // The redirect will happen via useEffect
  if (isLoading) {
    return null;
  }

  // If user exists but is not verified, return null (redirect is in progress)
  if (user && !user.emailVerified) {
    return null;
  }

  // User is verified (or not logged in - let other guards handle that)
  return <>{children}</>;
}

/**
 * useEmailVerificationRequired
 *
 * Hook version for cases where you need more control.
 * Returns whether the user needs to verify their email.
 *
 * Usage:
 * ```tsx
 * const { needsVerification, isLoading } = useEmailVerificationRequired();
 *
 * useEffect(() => {
 *   if (needsVerification) {
 *     router.push("/auth/verify-email-pending");
 *   }
 * }, [needsVerification]);
 * ```
 */
export function useEmailVerificationRequired() {
  const { user, isLoading } = useAuth();

  return {
    needsVerification: !isLoading && user && !user.emailVerified,
    isLoading,
    user,
  };
}
