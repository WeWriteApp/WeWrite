"use client";

import { Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useSearchParams } from 'next/navigation';
import { LoginForm, DevQuickLogin } from "../../components/forms/login-form"
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout"
import { Alert, AlertDescription } from "../../components/ui/alert";

function LoginContent() {
  const searchParams = useSearchParams();
  const action = searchParams?.get('action');
  const message = searchParams?.get('message');
  const isPostingReply = action === 'posting_reply';
  const isSessionRevoked = message === 'session_revoked';

  return (
    <ModernAuthLayout afterCard={<DevQuickLogin />}>
      {isPostingReply && (
        <Alert className="mb-4 bg-primary/10 border-theme-medium">
          <Icon name="AlertCircle" size={16} className="text-primary" />
          <AlertDescription className="text-primary">
            Sign in to post your reply. Your draft has been saved and will be posted automatically after you sign in.
          </AlertDescription>
        </Alert>
      )}

      {isSessionRevoked && (
        <Alert className="mb-4 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800">
          <Icon name="AlertCircle" size={16} className="text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            Your session was logged out from another device for security. Please sign in again.
          </AlertDescription>
        </Alert>
      )}

      <LoginForm />
    </ModernAuthLayout>
  )
}

// Static fallback that matches the form structure to prevent layout shift
function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign In</h1>
        <p className="text-muted-foreground">
          Welcome back to WeWrite
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>

        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </div>

      <div className="text-center space-y-4">
        <div className="h-4 w-40 mx-auto bg-muted rounded animate-pulse" />
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <ModernAuthLayout>
        <LoginFormSkeleton />
      </ModernAuthLayout>
    }>
      <LoginContent />
    </Suspense>
  );
}