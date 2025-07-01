"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ModernRegisterForm } from "../../components/forms/modern-register-form";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertCircle } from "lucide-react";

function RegisterContent(): JSX.Element {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const isPostingReply = action === 'posting_reply';

  return (
    <ModernAuthLayout
      title="Join Our Community"
      description="Create your account to start writing, collaborating, and sharing your ideas with the world."
    >
      {isPostingReply && (
        <Alert className="mb-4 bg-primary/10 border-theme-medium">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Create an account to post your reply. Your draft has been saved and will be posted automatically after you sign up.
          </AlertDescription>
        </Alert>
      )}

      <ModernRegisterForm />
    </ModernAuthLayout>
  );
}

export default function RegisterPage(): JSX.Element {
  return (
    <Suspense fallback={
      <ModernAuthLayout
        title="Join Our Community"
        description="Create your account to start writing, collaborating, and sharing your ideas with the world."
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </ModernAuthLayout>
    }>
      <RegisterContent />
    </Suspense>
  );
}