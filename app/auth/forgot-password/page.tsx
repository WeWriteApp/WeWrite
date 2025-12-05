"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ForgotPasswordForm } from "../../components/forms/forgot-password-form";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || '';

  return (
    <ModernAuthLayout>
      <ForgotPasswordForm initialEmail={email} />
    </ModernAuthLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <ModernAuthLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      </ModernAuthLayout>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}