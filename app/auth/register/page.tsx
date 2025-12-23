"use client";

import { Suspense } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useSearchParams } from 'next/navigation';
import { RegisterForm } from "../../components/forms/register-form";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";
import { Alert, AlertDescription } from "../../components/ui/alert";

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
          <Icon name="AlertCircle" size={16} className="text-primary" />
          <AlertDescription className="text-primary">
            Create an account to post your reply. Your draft has been saved and will be posted automatically after you sign up.
          </AlertDescription>
        </Alert>
      )}

      <RegisterForm />
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
          <Icon name="Loader" size={32} />
        </div>
      </ModernAuthLayout>
    }>
      <RegisterContent />
    </Suspense>
  );
}