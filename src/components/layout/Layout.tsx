"use client";

import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <main className="min-h-screen pt-4 pb-8">
      <div className="container mx-auto px-4">
        {children}
      </div>
    </main>
  );
} 