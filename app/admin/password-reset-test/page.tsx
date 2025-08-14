"use client";

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { LoadingButton } from "../../components/ui/loading-button";
import NavPageLayout from "../../components/layout/NavPageLayout";

export default function PasswordResetTestPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const runTest = async (action: string) => {
    if (!email) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);
    setError("");
    setResults(null);

    try {
      const response = await fetch('/api/debug/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, action }),
      });

      const data = await response.json();
      setResults(data);

      if (!response.ok) {
        setError(data.error || 'Test failed');
      }
    } catch (error: any) {
      console.error("Test error:", error);
      setError(error.message || 'Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const testPasswordReset = async () => {
    if (!email) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);
    setError("");
    setResults(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setResults({
        message: 'Password reset test completed',
        data,
        success: response.ok
      });

      if (!response.ok) {
        setError(data.error || 'Password reset failed');
      }
    } catch (error: any) {
      console.error("Password reset test error:", error);
      setError(error.message || 'Password reset test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NavPageLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Password Reset Testing</h1>
            <p className="text-muted-foreground mt-2">
              Debug and test password reset functionality
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Test Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <LoadingButton
                  onClick={() => runTest('check_user')}
                  isLoading={isLoading}
                  disabled={!email}
                  variant="outline"
                >
                  Check User Exists
                </LoadingButton>

                <LoadingButton
                  onClick={() => runTest('generate_link')}
                  isLoading={isLoading}
                  disabled={!email}
                  variant="outline"
                >
                  Generate Reset Link
                </LoadingButton>

                <LoadingButton
                  onClick={() => runTest('test_config')}
                  isLoading={isLoading}
                  disabled={!email}
                  variant="outline"
                >
                  Test Configuration
                </LoadingButton>

                <LoadingButton
                  onClick={testPasswordReset}
                  isLoading={isLoading}
                  disabled={!email}
                  className="bg-primary text-primary-foreground"
                >
                  Test Full Reset Flow
                </LoadingButton>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              {results && (
                <div className="bg-muted rounded-md p-4">
                  <h3 className="font-semibold mb-2">Test Results:</h3>
                  <pre className="text-xs overflow-auto bg-background p-3 rounded border">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Password Reset Flow Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Settings Reset Password → Firebase Client SDK → ✅ Should work</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Forgot Password Form → API + Firebase Fallback → ⚠️ Testing needed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Firebase Admin API → Server-side generation → 🔧 Recently fixed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NavPageLayout>
  );
}
