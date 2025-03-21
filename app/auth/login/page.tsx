"use client";

import { LoginForm } from "../../components/login-form"
import { AuthLayout } from "../../components/auth-layout"

export default function LoginPage() {
  return (
    <AuthLayout 
      title="Welcome to WeWrite"
      description="The collaborative writing platform where ideas come together. Join our community of writers, contribute to pages, and create lasting content."
    >
      <LoginForm />
    </AuthLayout>
  )
}