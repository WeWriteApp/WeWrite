"use client";

import { ReactNode, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent } from "./ui/card";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  // Prevent body scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 px-0">
      {/* Left side - Form */}
      <div className="flex flex-col h-full">
        <div className="mx-auto flex w-full flex-col justify-center flex-1 px-2 sm:w-[400px]">
          <Card className="mt-auto mb-auto border-theme-medium shadow-md bg-white dark:bg-background">
            <CardContent className="pt-2 pb-2 px-3 sm:pt-3 sm:pb-3 sm:px-4">
              {children}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="relative hidden h-full lg:block">
        <Image
          src="/images/auth-image.png"
          alt="WeWrite App on a smartphone"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-zinc-900/30" />
      </div>
    </div>
  );
}
