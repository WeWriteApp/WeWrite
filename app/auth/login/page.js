"use client";
import LoginForm from "../../components/LoginForm";

export async function generateMetadata() {
  return {
    title: "Login to WeWrite",
    description: "Login to your WeWrite account",
  };
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}