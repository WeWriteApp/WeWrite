"use client";

import { ModernRegisterForm } from "../../components/modern-register-form"
import { ModernAuthLayout } from "../../components/modern-auth-layout"

export default function RegisterPage() {
  return (
    <ModernAuthLayout
      title="Join Our Community"
      description="Create your account to start writing, collaborating, and sharing your ideas with the world."
    >
      <ModernRegisterForm />
    </ModernAuthLayout>
  );
}
