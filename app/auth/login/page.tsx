"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from "../../components/forms/login-form"
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout"
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertCircle } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const action = searchParams?.get('action');
  const message = searchParams?.get('message');
  const isPostingReply = action === 'posting_reply';
  const isSessionRevoked = message === 'session_revoked';

  return (
    <ModernAuthLayout>
      {isPostingReply && (
        <Alert className="mb-4 bg-primary/10 border-theme-medium">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Sign in to post your reply. Your draft has been saved and will be posted automatically after you sign in.
          </AlertDescription>
        </Alert>
      )}

      {isSessionRevoked && (
        <Alert className="mb-4 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            Your session was logged out from another device for security. Please sign in again.
          </AlertDescription>
        </Alert>
      )}

      <LoginForm />
    </ModernAuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <ModernAuthLayout
        title="Sign In"
        description="Welcome back to WeWrite"
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      </ModernAuthLayout>
    }>
      <LoginContent />
    </Suspense>
  );
}