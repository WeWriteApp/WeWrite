"use client";

import { RegisterForm } from "../../components/register-form"
import { AuthLayout } from "../../components/auth-layout"

export default function RegisterPage() {
  return (
    <AuthLayout 
      title="Join Our Community"
      description="Create your account to start writing, collaborating, and sharing your ideas with the world. WeWrite makes it easy to organize your thoughts and connect with other writers."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
