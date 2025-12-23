"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
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
          <Icon name="Loader" size={32} />
        </div>
      </ModernAuthLayout>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}