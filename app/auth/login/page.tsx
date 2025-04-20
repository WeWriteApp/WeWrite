"use client";

import { LoginForm } from "../../components/login-form"
import { AuthLayout } from "../../components/auth-layout"
import ReturnToPreviousAccount from "./ReturnToPreviousAccount"

export default function LoginPage() {
  return (
    <AuthLayout>
      <ReturnToPreviousAccount />
      <LoginForm />
    </AuthLayout>
  )
}