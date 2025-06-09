"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendEmailVerification, reload } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { Button } from "../../components/ui/button";
import { LoadingButton } from "../../components/ui/loading-button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { CheckCircle, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { AuthLayout } from "../../components/layout/auth-layout";

export default function VerifyEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [username, setUsername] = useState("");
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const router = useRouter();

  // Check if user came from the username setup flow
  useEffect(() => {
    const pendingUsername = localStorage.getItem('pendingUsername');
    
    if (!pendingUsername) {
      // Redirect to registration if no pending username
      router.push('/auth/register');
      return;
    }
    
    setUsername(pendingUsername);
    
    // Get current user email
    if (auth.currentUser) {
      setUserEmail(auth.currentUser.email || "");
      
      // Send initial verification email
      sendInitialVerificationEmail();
    } else {
      // No authenticated user, redirect to login
      router.push('/auth/login');
    }
  }, [router]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendInitialVerificationEmail = async () => {
    if (!auth.currentUser) return;
    
    try {
      await sendEmailVerification(auth.currentUser);
      console.log("Initial verification email sent");
      setSuccess(true);
    } catch (error: any) {
      console.error("Error sending initial verification email:", error);
      setError("Failed to send verification email. Please try again.");
    }
  };

  const handleResendEmail = async () => {
    if (!auth.currentUser || resendCooldown > 0) return;
    
    setIsResending(true);
    setError("");

    try {
      await sendEmailVerification(auth.currentUser);
      console.log("Verification email resent");
      setSuccess(true);
      setResendCooldown(60); // 60 second cooldown
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
        
        // Clear pending data
        localStorage.removeItem('pendingUsername');
        
        // Redirect to home page
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

  const handleSkipForNow = () => {
    // Clear pending data
    localStorage.removeItem('pendingUsername');
    
    // Redirect to home page without verification
    localStorage.setItem('authRedirectPending', 'true');
    setTimeout(() => {
      localStorage.removeItem('authRedirectPending');
      window.location.href = "/";
    }, 1000);
  };

  return (
    <AuthLayout
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
            <h2 className="text-lg font-semibold">Check Your Email</h2>
            <p className="text-sm text-muted-foreground">
              We've sent a verification link to <strong>{userEmail}</strong>. 
              Click the link in the email to verify your account and complete the setup.
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
          <LoadingButton
            onClick={checkEmailVerification}
            isLoading={isCheckingVerification}
            loadingText="Checking verification..."
            className="w-full"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            I've Verified My Email
          </LoadingButton>

          <LoadingButton
            variant="outline"
            onClick={handleResendEmail}
            isLoading={isResending}
            loadingText="Resending..."
            disabled={resendCooldown > 0}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}
          </LoadingButton>

          <Button
            variant="ghost"
            onClick={handleSkipForNow}
            className="w-full text-muted-foreground"
          >
            Skip for now (you can verify later)
          </Button>
        </div>

        {/* Help text */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>
            Didn't receive the email? Check your spam folder or try resending.
          </p>
          <p>
            Having trouble? <a href="mailto:support@wewrite.app" className="text-primary hover:underline">Contact support</a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
