"use client";

import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { ChevronLeft } from "lucide-react";
import React from "react";
import { FloatingHeader } from "../ui/FloatingCard";

interface Props {
  title: string;
  description?: string;
}

export function AdminSubpageHeader({ title, description }: Props) {
  const router = useRouter();

  return (
    <>
      <FloatingHeader className="fixed-header-sidebar-aware px-3 py-3 mb-4 flex items-start justify-between gap-3 lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2" noShadowAtTop>
        <div>
          <button
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push("/admin")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Admin
          </button>
          <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push("/")}>
          ✕
        </Button>
      </FloatingHeader>
      <div className="h-20 lg:hidden" aria-hidden />
    </>
  );
}
