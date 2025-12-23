"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Icon } from '@/components/ui/Icon';
import React from "react";

interface Props {
  title: string;
  description?: string;
}

export function AdminSubpageHeader({ title, description }: Props) {
  const router = useRouter();

  return (
    <header className="border-b bg-background px-4 py-3 flex items-start justify-between gap-3 lg:px-0 lg:py-4 lg:border-b-0">
      <div>
        <button
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push("/admin")}
        >
          <Icon name="ChevronLeft" size={16} className="mr-1" />
          Back to Admin
        </button>
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push("/")}>
        <Icon name="X" size={20} />
      </Button>
    </header>
  );
}
