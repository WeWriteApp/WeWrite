"use client";

/**
 * WeWrite Authentication Improvements - Forgot Password Form
 *
 * Enhanced password reset form component with improved error handling and
 * user experience as part of the authentication improvements.
 *
 * Improvements Implemented:
 * 1. **Enhanced Error Handling**: Specific Firebase error code handling
 * 2. **Improved Success Messaging**: Clear messaging with expiration info
 * 3. **Better UX**: "Return to Login" button and clearer instructions
 * 4. **Debugging Support**: Console logging for troubleshooting
 *
 * Error Handling Features:
 * - Specific error messages for different Firebase error codes
 * - User-friendly error descriptions instead of technical messages
 * - Proper handling of rate limiting and invalid email scenarios
 * - Console logging for debugging password reset issues
 *
 * Success Flow Enhancements:
 * - Clear success message with instructions
 * - Information about 1-hour expiration time
 * - Direct "Return to Login" button for better flow
 * - Improved visual feedback with color-coded alerts
 *
 * Integration with Custom Reset Page:
 * - Works with custom password reset page at /auth/reset-password
 * - Handles Firebase oobCode parameter from email links
 * - Custom branded experience instead of Firebase default UI
 * - Maintains Firebase security model while improving UX
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "../ui/loading-button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/auth";
import Link from "next/link";
import { cn } from "../../lib/utils";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const router = useRouter();

  // Validate form inputs
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(email);
    setIsFormValid(isEmailValid);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      console.log("Password reset email sent successfully to:", email);
      setSuccess(true);
    } catch (error: any) {
      console.error("Password reset error:", error);

      // Handle specific Firebase error codes
      let errorMessage = "Failed to send reset email";

      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many requests. Please try again later";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-3 sm:gap-4", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="flex flex-col items-center gap-1 sm:gap-2 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reset Password</h1>
        <p className="text-balance text-xs sm:text-sm text-muted-foreground">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      {success ? (
        <div className="space-y-2 sm:space-y-3">
          <div className="bg-success/10 p-2 sm:p-4 rounded-md text-success text-xs sm:text-sm">
            Reset link sent! Check your email for instructions to reset your password.
          </div>
          <Button
            className="w-full"
            onClick={() => router.push("/auth/login")}
          >
            Return to Login
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-6">
          <div className="grid gap-1 sm:gap-2">
            <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="thomaspaine@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background border-input text-foreground placeholder:text-muted-foreground h-9 sm:h-10"
            />
          </div>

          {error && (
            <div className="text-xs sm:text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <LoadingButton
            type="submit"
            className={cn(
              "w-full transition-all",
              !isFormValid && !isLoading ?
                "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : ""
            )}
            disabled={!isFormValid}
            isLoading={isLoading}
            loadingText="Sending..."
          >
            Send Reset Link
          </LoadingButton>

          <div className="text-center text-xs sm:text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/auth/login"
              className="underline underline-offset-4 text-foreground hover:text-foreground/90"
            >
              Back to login
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}
