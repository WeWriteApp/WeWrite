"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ModernLoginForm } from "../../components/forms/modern-login-form"
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout"
import ReturnToPreviousAccount from "./ReturnToPreviousAccount"
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertCircle } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const action = searchParams?.get('action');
  const isPostingReply = action === 'posting_reply';

  return (
    <ModernAuthLayout>
      <ReturnToPreviousAccount />

      {isPostingReply && (
        <Alert className="mb-4 bg-primary/10 border-theme-medium">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Sign in to post your reply. Your draft has been saved and will be posted automatically after you sign in.
          </AlertDescription>
        </Alert>
      )}

      <ModernLoginForm />
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