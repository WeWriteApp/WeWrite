"use client";

import { useEffect, useState, useCallback } from "react";
import { Icon } from '@/components/ui/Icon';
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { auth } from "../../firebase/config";
import { LandingBlobs } from "../landing/LandingBlobs";

// Cooldown durations in seconds: 60s, 2min, 5min, 10min
const COOLDOWN_DURATIONS = [60, 120, 300, 600];

interface EmailVerificationModalProps {
  onDismiss?: () => void;
  showDismissButton?: boolean;
}

/**
 * Full-screen modal that blocks access until email is verified.
 * Shows colorful blobs as background for visual consistency.
 */
export function EmailVerificationModal({ onDismiss, showDismissButton = false }: EmailVerificationModalProps) {
  const { user, refreshUser, signOut } = useAuth();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

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

  // Format cooldown time as readable string
  const formatCooldown = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${seconds}s`;
  };

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
        // Progressive cooldown: 60s, 2min, 5min, 10min
        const cooldownIndex = Math.min(resendAttempts, COOLDOWN_DURATIONS.length - 1);
        setResendCooldown(COOLDOWN_DURATIONS[cooldownIndex]);
        setResendAttempts(prev => prev + 1);
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

  const handleEditEmail = () => {
    setNewEmail(user?.email || "");
    setEmailError("");
    setIsEditingEmail(true);
  };

  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
    setNewEmail("");
    setEmailError("");
  };

  const handleUpdateEmail = async () => {
    if (!user || !newEmail || isUpdatingEmail) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (newEmail === user.email) {
      setEmailError("This is already your current email");
      return;
    }

    setIsUpdatingEmail(true);
    setEmailError("");

    try {
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch("/api/users/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail,
          userId: user.uid,
          idToken,
        }),
      });

      if (response.ok) {
        // Refresh user to get new email
        await refreshUser();
        setIsEditingEmail(false);
        setNewEmail("");
        // Reset cooldown and attempts since email changed
        setResendCooldown(0);
        setResendAttempts(0);
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        const data = await response.json();
        setEmailError(data.error || "Failed to update email");
      }
    } catch (error) {
      console.error("Error updating email:", error);
      setEmailError("Failed to update email. Please try again.");
    } finally {
      setIsUpdatingEmail(false);
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
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      {/* Animated blobs background - fixed position */}
      <div className="fixed inset-0 pointer-events-none">
        <LandingBlobs />
      </div>

      {/* Scrollable content container */}
      <div className="min-h-full flex items-center justify-center py-8 px-4">
        {/* Content card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="wewrite-card rounded-xl p-6 md:p-8 relative">
            {/* X close button - top right */}
            {showDismissButton && (
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <Icon name="X" size={20} />
              </button>
            )}

            <div className="flex flex-col items-center gap-6 py-2">
              {/* Email icon */}
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="Mail" size={40} className="text-primary" />
              </div>

              {/* Title and message */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Verify Your Email</h2>
                <p className="text-foreground">
                  We've sent a verification link to:
                </p>

                {/* Email display or edit form */}
                {isEditingEmail ? (
                  <div className="w-full space-y-3 mt-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                      className="text-center"
                      autoFocus
                    />
                    {emailError && (
                      <p className="text-sm text-destructive">{emailError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleCancelEditEmail}
                        className="flex-1"
                        disabled={isUpdatingEmail}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateEmail}
                        className="flex-1"
                        disabled={isUpdatingEmail || !newEmail}
                      >
                        {isUpdatingEmail ? (
                          <>
                            <Icon name="Loader" />
                            Updating...
                          </>
                        ) : (
                          "Save & Send"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <p className="font-medium text-foreground text-lg">
                      {user.email}
                    </p>
                    <button
                      onClick={handleEditEmail}
                      className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Edit email"
                    >
                      <Icon name="Pencil" size={16} />
                    </button>
                  </div>
                )}

                <p className="text-sm text-muted-foreground mt-4">
                  Click the link in your email to verify your account and start using WeWrite.
                </p>
              </div>

              {/* Success message */}
              {resendSuccess && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-4 py-2 rounded-lg">
                  <Icon name="CheckCircle" size={16} />
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
                      <Icon name="Loader" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Icon name="RefreshCw" size={16} className="mr-2" />
                      Refresh
                    </>
                  )}
                </Button>

                {/* Resend email */}
                <Button
                  variant="secondary"
                  onClick={handleResendEmail}
                  disabled={resendCooldown > 0 || isResending}
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Icon name="Loader" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icon name="Mail" size={16} className="mr-2" />
                      Resend verification email
                    </>
                  )}
                </Button>

                {/* Cooldown countdown - shown below the button when active */}
                {resendCooldown > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    You can resend in {formatCooldown(resendCooldown)}
                  </p>
                )}

                {/* Do this later - only shown when dismissable */}
                {showDismissButton && (
                  <Button
                    variant="secondary"
                    onClick={handleDismiss}
                    className="w-full"
                  >
                    <Icon name="Clock" size={16} className="mr-2" />
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

              {/* Sign out option - at the very bottom */}
              <Button
                variant="secondary"
                onClick={handleSignOut}
                className="w-full text-destructive hover:text-destructive mt-4"
              >
                <Icon name="LogOut" size={16} className="mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationModal;
