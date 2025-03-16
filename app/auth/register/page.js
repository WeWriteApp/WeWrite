"use client";

import RegisterForm from "../../components/RegisterForm";

export async function generateMetadata() {
  return {
    title: "Register to WeWrite",
    description: "Register to your WeWrite account",
  };
}

export default function Register() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <RegisterForm />
    </div>
  );
}


