"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { LoadingButton } from "../../components/ui/loading-button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../../components/layout/auth-layout";

export default function CustomPasswordResetPage() {
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
        // Verify the password reset code and get the user's email
        const email = await verifyPasswordResetCode(auth, oobCode);
        setUserEmail(email);
        setIsValidCode(true);
        console.log("Password reset code verified for:", email);
      } catch (error: any) {
        console.error("Error verifying password reset code:", error);
        
        let errorMessage = "Invalid or expired password reset link";
        if (error.code === 'auth/invalid-action-code') {
          errorMessage = "This password reset link is invalid or has already been used";
        } else if (error.code === 'auth/expired-action-code') {
          errorMessage = "This password reset link has expired. Please request a new one";
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
      // Confirm the password reset with the new password
      await confirmPasswordReset(auth, oobCode, password);
      console.log("Password reset successful for:", userEmail);
      setSuccess(true);
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      let errorMessage = "Failed to reset password";
      if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please choose a stronger password";
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = "This password reset link is invalid or has already been used";
      } else if (error.code === 'auth/expired-action-code') {
        errorMessage = "This password reset link has expired. Please request a new one";
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
      <AuthLayout
        title="Verifying Reset Link"
        description="Please wait while we verify your password reset link..."
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AuthLayout>
    );
  }

  // Show error if code is invalid
  if (!isValidCode) {
    return (
      <AuthLayout
        title="Invalid Reset Link"
        description="This password reset link is invalid or has expired."
      >
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
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
              variant="outline"
              onClick={() => router.push("/auth/login")}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Show success page
  if (success) {
    return (
      <AuthLayout
        title="Password Reset Successful"
        description="Your password has been successfully reset."
      >
        <div className="space-y-4">
          <Alert className="bg-green-500/20 text-green-600 dark:text-green-200">
            <CheckCircle className="h-4 w-4" />
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
      </AuthLayout>
    );
  }

  // Show password reset form
  return (
    <AuthLayout
      title="Reset Your Password"
      description={`Enter a new password for ${userEmail}`}
    >
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
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
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
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
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
            variant="outline"
            onClick={() => router.push("/auth/login")}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}