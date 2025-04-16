"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { LoadingButton } from "../../components/ui/loading-button";
import NavHeader from "../../components/NavHeader";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
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
    <div className="container max-w-md mx-auto px-4 py-8">
      <NavHeader 
        title="Reset Password" 
        backUrl="/account" 
        backLabel="Back to Account"
      />

      {/* Add meta tag for password managers */}
      <head>
        <meta name="apple-itunes-app" content="app-id=123456789, app-argument=https://wewrite.com/account/reset-password" />
        <meta name="password-reset" content="true" />
      </head>

      <div className="space-y-6">
        {success ? (
          <Alert className="bg-green-500/20 text-green-600 dark:text-green-200">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Email Sent</AlertTitle>
            <AlertDescription>
              Check your email for instructions to reset your password.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
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
                loadingText="Sending..."
                disabled={!email}
              >
                Send Reset Link
              </LoadingButton>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/account")}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
