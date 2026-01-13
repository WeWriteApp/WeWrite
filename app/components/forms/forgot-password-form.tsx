"use client";

import { InlineError } from '../ui/InlineError';

/**
 * Forgot Password Form
 *
 * Sends password reset emails via our API (which uses Firebase Admin SDK
 * to generate reset links and Resend to send branded emails).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "../ui/loading-button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { isValidEmail } from '@/utils/validationPatterns';

export function ForgotPasswordForm({
  className,
  initialEmail = '',
  ...props
}: React.ComponentPropsWithoutRef<"form"> & { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const router = useRouter();

  // Validate form inputs
  useEffect(() => {
    const isEmailValid = isValidEmail(email);
    setIsFormValid(isEmailValid);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        throw new Error(data.error || 'Failed to send reset email');
      }

      setSuccess(true);

    } catch (error: any) {
      let errorMessage = error.message || "Failed to send reset email. Please try again.";

      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. The server may be busy. Please try again.";
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.message.includes('JSON')) {
        errorMessage = "Server communication error. Please try again.";
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
            <InlineError
              variant="error"
              title="Password Reset Error"
              message={error}
              showCopy={error.includes('Technical details:')}
            />
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
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Back to login
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}