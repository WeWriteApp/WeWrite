"use client";

import { useState, useEffect, Suspense } from "react";
import { Icon } from '@/components/ui/Icon';
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { LoadingButton } from "../../components/ui/loading-button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";

function CustomPasswordResetContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidCode, setIsValidCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams?.get('oobCode');
  const mode = searchParams?.get('mode');

  // Verify the reset code on component mount
  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode || mode !== 'resetPassword') {
        setError("Invalid or missing password reset link");
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the password reset code using API endpoint
        const response = await fetch(`/api/auth/reset-password?oobCode=${encodeURIComponent(oobCode)}`, {
          method: 'GET',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to verify reset code');
        }

        const data = await response.json();
        setUserEmail(data.email);
        setIsValidCode(true);
        console.log("Password reset code verified for:", data.email);
      } catch (error: any) {
        console.error("Error verifying password reset code:", error);

        // Enhanced error logging for debugging
        console.error("🔐 [Reset Password Page] Detailed verification error:", {
          message: error.message,
          code: error.code,
          stack: error.stack,
          oobCode: oobCode?.substring(0, 10) + '...',
          timestamp: new Date().toISOString()
        });

        let errorMessage = "Invalid or expired password reset link";
        if (error.message.includes('invalid-action-code')) {
          errorMessage = "This password reset link is invalid or has already been used";
        } else if (error.message.includes('expired-action-code')) {
          errorMessage = "This password reset link has expired. Please request a new one";
        } else if (error.message.includes('Failed to verify reset code:')) {
          // Show the detailed error message from the API
          errorMessage = error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        setError(errorMessage);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidCode || !oobCode) {
      setError("Invalid password reset session");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Confirm the password reset with the new password using API endpoint
      const response = await fetch('/api/auth/reset-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oobCode,
          newPassword: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const data = await response.json();
      console.log("Password reset successful for:", userEmail);
      setSuccess(true);
    } catch (error: any) {
      console.error("Password reset error:", error);

      // Enhanced error logging for debugging
      console.error("🔐 [Reset Password Page] Detailed confirmation error:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
        userEmail: userEmail,
        timestamp: new Date().toISOString()
      });

      let errorMessage = "Failed to reset password";
      if (error.message.includes('weak-password')) {
        errorMessage = "Password is too weak. Please choose a stronger password";
      } else if (error.message.includes('invalid-action-code')) {
        errorMessage = "This password reset link is invalid or has already been used";
      } else if (error.message.includes('expired-action-code')) {
        errorMessage = "This password reset link has expired. Please request a new one";
      } else if (error.message.includes('Failed to reset password:')) {
        // Show the detailed error message from the API
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while verifying the code
  if (isVerifying) {
    return (
      <ModernAuthLayout>
        <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Verifying Reset Link</h1>
          <p className="text-balance text-xs sm:text-sm text-muted-foreground">
            Please wait while we verify your password reset link...
          </p>
        </div>
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader" size={32} />
        </div>
      </ModernAuthLayout>
    );
  }

  // Show error if code is invalid
  if (!isValidCode) {
    return (
      <ModernAuthLayout>
        <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Invalid Reset Link</h1>
          <p className="text-balance text-xs sm:text-sm text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="space-y-4">
          <Alert variant="destructive">
            <Icon name="AlertCircle" size={16} />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>

          <div className="flex flex-col space-y-2">
            <Button
              onClick={() => router.push("/auth/forgot-password")}
              className="w-full"
            >
              Request New Reset Link
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/auth/login")}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </ModernAuthLayout>
    );
  }

  // Show success page
  if (success) {
    return (
      <ModernAuthLayout>
        <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Password Reset Successful</h1>
          <p className="text-balance text-xs sm:text-sm text-muted-foreground">
            Your password has been successfully reset.
          </p>
        </div>

        <div className="space-y-4">
          <Alert className="bg-green-500/20 text-green-600 dark:text-green-200">
            <Icon name="CheckCircle" size={16} />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Your password has been successfully reset. You can now sign in with your new password.
            </AlertDescription>
          </Alert>

          <Button
            onClick={() => router.push("/auth/login")}
            className="w-full"
          >
            Sign In Now
          </Button>
        </div>
      </ModernAuthLayout>
    );
  }

  // Show password reset form
  return (
    <ModernAuthLayout>
      <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reset Your Password</h1>
        <p className="text-balance text-xs sm:text-sm text-muted-foreground">
          Enter a new password for {userEmail}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={6}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <Icon name="EyeOff" size={16} />
              ) : (
                <Icon name="Eye" size={16} />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={6}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <Icon name="EyeOff" size={16} />
              ) : (
                <Icon name="Eye" size={16} />
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <Icon name="AlertCircle" size={16} />
            <AlertTitle>Password Reset Error</AlertTitle>
            <AlertDescription>
              {error}
              {error.includes('Technical details:') && (
                <div className="text-xs text-destructive/70 mt-2">
                  Please include these details when contacting support.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col space-y-2">
          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText="Resetting Password..."
            disabled={!password || !confirmPassword || password !== confirmPassword}
            className="w-full"
          >
            Reset Password
          </LoadingButton>

          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/auth/login")}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </form>
    </ModernAuthLayout>
  );
}

export default function CustomPasswordResetPage() {
  return (
    <Suspense fallback={
      <ModernAuthLayout>
        <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="text-balance text-xs sm:text-sm text-muted-foreground">
            Loading...
          </p>
        </div>
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader" size={32} />
        </div>
      </ModernAuthLayout>
    }>
      <CustomPasswordResetContent />
    </Suspense>
  );
}