"use client";

import { useSearchParams } from 'next/navigation';
import { ModernRegisterForm } from "../../components/modern-register-form"
import { ModernAuthLayout } from "../../components/modern-auth-layout"
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const isPostingReply = action === 'posting_reply';

  return (
    <ModernAuthLayout
      title="Join Our Community"
      description="Create your account to start writing, collaborating, and sharing your ideas with the world."
    >
      {isPostingReply && (
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
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
