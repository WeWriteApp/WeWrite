"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../ui/button";
import { auth } from "../../firebase/config";
import { Mail, Loader2, RefreshCw, CheckCircle, LogOut, Clock } from "lucide-react";
import { LandingColorProvider } from "../landing/LandingColorContext";
import { LandingBlobs } from "../landing/LandingBlobs";

interface EmailVerificationModalProps {
  onDismiss?: () => void;
  showDismissButton?: boolean;
}

/**
 * Full-screen modal that blocks access until email is verified.
 * Shows the same colorful blobs as auth pages for visual consistency.
 */
export function EmailVerificationModal({ onDismiss, showDismissButton = false }: EmailVerificationModalProps) {
  const { user, refreshUser, signOut } = useAuth();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  // Check for verification status periodically and on visibility change
  const checkVerificationStatus = useCallback(async () => {
    if (!user || isCheckingVerification) return;

    setIsCheckingVerification(true);
    try {
      await refreshUser();
    } catch (error) {
      console.error("Error checking verification status:", error);
    } finally {
      setIsCheckingVerification(false);
    }
  }, [user, refreshUser, isCheckingVerification]);

  // Listen for page visibility changes (user returns from email)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !user.emailVerified) {
        checkVerificationStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, checkVerificationStatus]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (!user || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setResendSuccess(false);

    try {
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          userId: user.uid,
          username: user.username,
          idToken,
        }),
      });

      if (response.ok) {
        setResendSuccess(true);
        setResendCooldown(60); // 60 second cooldown
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        console.error("Failed to resend verification email");
      }
    } catch (error) {
      console.error("Error resending verification email:", error);
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDismiss = () => {
    if (onDismiss) {
      // Set dismissal flag
      localStorage.setItem('wewrite_email_verification_dismissed', 'true');
      // Dispatch event to notify BannerProvider to re-check and show the banner
      window.dispatchEvent(new CustomEvent('bannerOverrideChange'));
      onDismiss();
    }
  };

  if (!user) return null;

  return (
    <LandingColorProvider>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        {/* Animated blobs background */}
        <LandingBlobs />

        {/* Content card */}
        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="wewrite-card rounded-xl p-6 md:p-8">
            <div className="flex flex-col items-center gap-6 py-2">
              {/* Email icon */}
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>

              {/* Title and message */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Verify Your Email</h2>
                <p className="text-foreground">
                  We've sent a verification link to:
                </p>
                <p className="font-medium text-foreground text-lg">
                  {user.email}
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Click the link in your email to verify your account and start using WeWrite.
                </p>
              </div>

              {/* Success message */}
              {resendSuccess && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-4 py-2 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Verification email sent!</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="w-full space-y-3 mt-2">
                {/* Check verification status */}
                <Button
                  onClick={checkVerificationStatus}
                  disabled={isCheckingVerification}
                  className="w-full"
                >
                  {isCheckingVerification ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      I've verified my email
                    </>
                  )}
                </Button>

                {/* Resend email */}
                <Button
                  variant="outline"
                  onClick={handleResendEmail}
                  disabled={resendCooldown > 0 || isResending}
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>Resend email in {resendCooldown}s</>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend verification email
                    </>
                  )}
                </Button>

                {/* Do this later - only shown when dismissable */}
                {showDismissButton && (
                  <Button
                    variant="ghost"
                    onClick={handleDismiss}
                    className="w-full text-muted-foreground"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Do this later
                  </Button>
                )}
              </div>

              {/* Help text */}
              <div className="text-center text-sm text-muted-foreground space-y-2 pt-2">
                <p>
                  Didn't receive the email? Check your spam folder or try resending.
                </p>
              </div>

              {/* Sign out option */}
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
              >
                <LogOut className="h-4 w-4" />
                Sign out and use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    </LandingColorProvider>
  );
}

export default EmailVerificationModal;
