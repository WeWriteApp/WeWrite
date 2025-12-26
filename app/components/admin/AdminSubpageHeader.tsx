"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Icon } from '@/components/ui/Icon';
import React from "react";

interface Props {
  title: string;
  description?: string;
}

/**
 * AdminSubpageHeader - Desktop-only header for admin subpages
 *
 * On mobile, the admin drawer header handles navigation (back button, title).
 * This header is hidden on mobile (< lg breakpoint) to avoid redundancy.
 */
export function AdminSubpageHeader({ title, description }: Props) {
  const router = useRouter();

  return (
    <header className="hidden lg:flex border-b bg-background px-4 py-3 items-start justify-between gap-3 lg:px-0 lg:py-4 lg:border-b-0">
      <div>
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push("/")}>
        <Icon name="X" size={20} />
      </Button>
    </header>
  );
}
