"use client";

import React from 'react';

export interface SectionProps {
  id: string;
}

export interface ComponentShowcaseProps {
  id: string;
  title: string;
  path: string;
  description: string;
  children: React.ReactNode;
}

export function ComponentShowcase({ id, title, path, description, children }: ComponentShowcaseProps) {
  return (
    <div id={id} className="wewrite-card space-y-4 scroll-mt-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{path}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

export function StateDemo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <div className="flex flex-wrap gap-2 items-center">
        {children}
      </div>
    </div>
  );
}
