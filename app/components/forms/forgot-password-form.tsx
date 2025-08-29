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
// Using API endpoints instead of direct Firebase calls
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
      console.log("🔐 [Forgot Password Form] Attempting password reset for:", email.substring(0, 3) + '***@' + email.split('@')[1]);

      // Use API-first approach - no Firebase client SDK fallback
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        // API returned an error - use the detailed error message from the API
        console.error("🔐 [Forgot Password Form] API error:", data);
        throw new Error(data.error || 'Failed to send reset email');
      }

      console.log("🔐 [Forgot Password Form] Reset email sent successfully:", data);
      setSuccess(true);

    } catch (error: any) {
      console.error("🔐 [Forgot Password Form] Error:", error);

      // Use the error message from the API if available, otherwise provide fallback
      let errorMessage = error.message || "Failed to send reset email. Please try again.";

      // Handle specific error types
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. The server may be busy. Please try again.";
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.message.includes('JSON')) {
        errorMessage = "Server communication error. Please try again.";
      } else if (error.message.includes('Password reset system error')) {
        // For system errors, show the full message which now includes technical details
        errorMessage = error.message;
      }

      // Log additional error details for debugging
      console.error("🔐 [Forgot Password Form] Detailed error info:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        email: email.substring(0, 3) + '***@' + email.split('@')[1],
        timestamp: new Date().toISOString()
      });

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
            <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20">
              <div className="text-xs sm:text-sm font-medium text-destructive mb-1">
                Password Reset Error
              </div>
              <div className="text-xs sm:text-sm text-destructive/90">
                {error}
              </div>
              {error.includes('Technical details:') && (
                <div className="text-xs text-destructive/70 mt-2">
                  Please include these details when contacting support.
                </div>
              )}
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
            loadingText="Sending reset link..."
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