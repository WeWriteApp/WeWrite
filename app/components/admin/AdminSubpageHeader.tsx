"use client";

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
  return (
    <header className="hidden lg:flex bg-background px-4 py-3 items-start gap-3 lg:px-0 lg:py-4">
      <div>
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
    </header>
  );
}
