"use client";

import { ModernLoginForm } from "../../components/modern-login-form"
import { ModernAuthLayout } from "../../components/modern-auth-layout"
import ReturnToPreviousAccount from "./ReturnToPreviousAccount"

export default function LoginPage() {
  return (
    <ModernAuthLayout>
      <ReturnToPreviousAccount />
      <ModernLoginForm />
    </ModernAuthLayout>
  )
}