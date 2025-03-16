"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export default function LinkButton({ href, children, className = "" }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 ${className}`}
    >
      {children}
    </Link>
  );
} 