"use client";

import { useState } from "react";
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
  const router = useRouter();

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
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-white">Reset Password</h1>
        <p className="text-balance text-sm text-white/70">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>
      
      {success ? (
        <div className="space-y-4">
          <div className="bg-green-500/20 p-4 rounded-md text-green-200 text-sm">
            Reset link sent! Check your email for instructions to reset your password.
          </div>
          <Button 
            className="w-full bg-white text-blue-950 hover:bg-white/90" 
            onClick={() => router.push("/auth/login")}
          >
            Return to Login
          </Button>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="thomaspaine@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>
          
          {error && (
            <div className="text-sm font-medium text-red-400">
              {error}
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full bg-white text-blue-950 hover:bg-white/90" 
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
          
          <div className="text-center text-sm text-white/80">
            Remember your password?{" "}
            <Link 
              href="/auth/login" 
              className="underline underline-offset-4 text-white hover:text-white/90"
            >
              Back to login
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}
