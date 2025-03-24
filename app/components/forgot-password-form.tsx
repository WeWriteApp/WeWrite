"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/auth";
import Link from "next/link";
import { cn } from "../lib/utils";

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
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form 
      className={cn("flex flex-col gap-3 sm:gap-6", className)}
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
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-green-500/20 p-2 sm:p-4 rounded-md text-green-600 dark:text-green-200 text-xs sm:text-sm">
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
          
          <Button 
            type="submit" 
            className={cn(
              "w-full transition-all",
              !isFormValid && !isLoading ? 
                "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : ""
            )}
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
          
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
