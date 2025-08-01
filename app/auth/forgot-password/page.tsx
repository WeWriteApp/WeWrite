"use client";

import { ForgotPasswordForm } from "../../components/forms/forgot-password-form";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";

export default function ForgotPasswordPage() {
  return (
    <ModernAuthLayout>
      <ForgotPasswordForm />
    </ModernAuthLayout>
  );
}