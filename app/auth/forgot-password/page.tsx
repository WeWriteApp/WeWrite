"use client";

import { ForgotPasswordForm } from "../../components/forgot-password-form";
import { AuthLayout } from "../../components/auth-layout";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout 
      title="Reset Your Password"
      description="We'll send you instructions on how to reset your password. Enter the email address you used when you joined."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
