"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// Removed direct Firebase imports - now using API endpoints
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { CheckCircle, AlertCircle, Mail, RefreshCw, Loader2, Settings, Clock } from "lucide-react";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { auth } from "../../firebase/config";
import { sendEmailVerification, reload } from 'firebase/auth';
import {
  getResendCooldownRemaining,
  canResendVerificationEmail,
  startResendCooldown
} from '../../services/emailVerificationNotifications';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();

  // Check authentication state and send initial verification email
  useEffect(() => {
    const initializeVerification = async () => {
      // Wait for auth state to be determined
      if (isLoading) return;

      if (!isAuthenticated || !currentAccount) {
        // No authenticated user, redirect to login
        router.push('/auth/login');
        return;
      }

      // Check if user is already verified
      if (currentAccount.emailVerified) {
        // User is already verified, redirect to home
        router.push('/');
        return;
      }

      setUserEmail(currentAccount.email || "");

      // Send initial verification email using API
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: currentAccount.email
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log("Initial verification email sent");
          setSuccess(true);
        } else {
          throw new Error(result.error || 'Failed to send verification email');
        }
      } catch (error: any) {
        console.error("Error sending initial verification email:", error);
        setError(error.message || "Failed to send verification email. Please try again.");
      }

      setIsInitializing(false);
    };

    initializeVerification();
  }, [router, isAuthenticated, currentAccount, isLoading]);

  // Update cooldown timer
  useEffect(() => {
    const updateCooldown = () => {
      setCooldownRemaining(getResendCooldownRemaining());
    };

    // Initial update
    updateCooldown();

    // Update every second while cooldown is active
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleResendEmail = async () => {
    if (!auth.currentUser || !canResendVerificationEmail()) return;

    setIsResending(true);
    setError("");
    setSuccess(false);

    try {
      await sendEmailVerification(auth.currentUser);
      startResendCooldown();
      setCooldownRemaining(getResendCooldownRemaining());

      console.log("Verification email resent");
      setSuccess(true);
    } catch (error: any) {
      console.error("Error resending verification email:", error);

      let errorMessage = "Failed to resend verification email";
      if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many requests. Please wait before trying again";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  const checkEmailVerification = async () => {
    if (!auth.currentUser) return;

    setIsCheckingVerification(true);
    setError("");

    try {
      // Reload the user to get the latest email verification status
      await reload(auth.currentUser);

      if (auth.currentUser.emailVerified) {
        console.log("Email verified successfully!");

        // Redirect to home page with success message
        localStorage.setItem('authRedirectPending', 'true');
        setTimeout(() => {
          localStorage.removeItem('authRedirectPending');
          window.location.href = "/";
        }, 1500);
      } else {
        setError("Email not yet verified. Please check your email and click the verification link.");
      }
    } catch (error: any) {
      console.error("Error checking email verification:", error);
      setError("Failed to check verification status. Please try again.");
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <ModernAuthLayout
        title="Verify Your Email"
        description="Setting up email verification..."
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ModernAuthLayout>
    );
  }

  return (
    <ModernAuthLayout
      title="Verify Your Email"
      description={`We've sent a verification link to ${userEmail}`}
    >
      <div className="space-y-6">
        {/* Email sent confirmation */}
        {success && (
          <Alert className="bg-green-500/20 text-green-600 dark:text-green-200">
            <Mail className="h-4 w-4" />
            <AlertTitle>Verification Email Sent</AlertTitle>
            <AlertDescription>
              Check your email and click the verification link to complete your account setup.
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Email Verification Required</h2>
            <p className="text-sm text-muted-foreground">
              We've sent a verification link to <strong>{userEmail}</strong>.
              You must verify your email address before you can access the application.
            </p>
            <p className="text-xs text-muted-foreground">
              Don't forget to check your spam folder if you don't see the email.
            </p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={checkEmailVerification}
            disabled={isCheckingVerification}
            className="w-full"
          >
            {isCheckingVerification ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking verification...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                I've Verified My Email
              </>
            )}
          </Button>

          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleResendEmail}
              disabled={isResending || cooldownRemaining > 0}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  {cooldownRemaining > 60
                    ? `Resend in ${Math.ceil(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s`
                    : `Resend in ${cooldownRemaining}s`
                  }
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>
            {cooldownRemaining > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Didn't receive the email? You can resend in{' '}
                {cooldownRemaining > 60
                  ? `${Math.ceil(cooldownRemaining / 60)} minute${Math.ceil(cooldownRemaining / 60) > 1 ? 's' : ''} and ${cooldownRemaining % 60} second${cooldownRemaining % 60 !== 1 ? 's' : ''}`
                  : `${cooldownRemaining} second${cooldownRemaining !== 1 ? 's' : ''}`
                }
              </p>
            )}
          </div>
        </div>

        {/* Help text */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>
            Check your spam folder if you don't see the email.
          </p>
          <p>
            Need to change your email address? <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={() => router.push('/auth/register')}>Register with a different email</Button>
          </p>
        </div>
      </div>
    </ModernAuthLayout>
  );
}