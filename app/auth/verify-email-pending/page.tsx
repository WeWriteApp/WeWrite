"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";
import { Button } from "../../components/ui/button";
import { auth } from "../../firebase/config";
import { Mail, Loader2, RefreshCw, CheckCircle, LogOut, Clock } from "lucide-react";

export default function VerifyEmailPendingPage() {
  const router = useRouter();
  const { user, isLoading, refreshUser, signOut } = useAuth();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isAdminTestingMode, setIsAdminTestingMode] = useState(false);

  // Check if we're in admin testing mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminOverride = localStorage.getItem('wewrite_admin_email_banner_override');
      setIsAdminTestingMode(adminOverride === 'true');
    }
  }, []);

  // Redirect if user is already verified (unless in admin testing mode) or not logged in
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/auth/login");
        return;
      }
      // In admin testing mode, allow verified users to see this page
      if (user.emailVerified && !isAdminTestingMode) {
        router.push("/home");
        return;
      }
    }
  }, [user, isLoading, router, isAdminTestingMode]);

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

  if (isLoading) {
    return (
      <ModernAuthLayout
        title="Verify Your Email"
        description="Check your inbox to continue"
        showTerms={false}
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </ModernAuthLayout>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <ModernAuthLayout
      title="Verify Your Email"
      description="One more step to get started"
      showTerms={false}
    >
      <div className="flex flex-col items-center gap-6 py-2">
        {/* Email icon */}
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-10 w-10 text-primary" />
        </div>

        {/* Message */}
        <div className="text-center space-y-2">
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

          {/* Do this later - allows users to skip for now and verify via banner */}
          <Button
            variant="ghost"
            onClick={() => {
              // Set dismissal flag and navigate home
              localStorage.setItem('wewrite_email_verification_dismissed', 'true');
              router.push('/home');
            }}
            className="w-full text-muted-foreground"
          >
            <Clock className="h-4 w-4 mr-2" />
            Do this later
          </Button>
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
    </ModernAuthLayout>
  );
}
