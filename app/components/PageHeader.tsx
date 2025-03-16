"use client";

import * as React from "react";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface PageHeaderProps {
  title?: string;
  showBackButton?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  showBackButton = true, 
  className,
  children 
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className={cn("flex items-center gap-4 py-4", className)}>
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-full"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
      )}
      {title && <h1 className="text-2xl font-semibold">{title}</h1>}
      {children}
    </div>
  );
} 