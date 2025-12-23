"use client";

import React from 'react';
import IconsShowcase from '../../../components/design-system/IconsShowcase';

export function IconsSection({ id }: { id: string }) {
  return (
    <div id={id} className="wewrite-card space-y-4 scroll-mt-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold">Icons</h3>
        <p className="text-sm text-muted-foreground">app/components/ui/Icon.tsx</p>
        <p className="text-sm text-muted-foreground mt-1">
          Phosphor icons with 3 variants: <span className="font-mono text-xs bg-muted px-1 rounded">outline</span> (regular weight),
          <span className="font-mono text-xs bg-muted px-1 rounded">solid</span> (fill weight), and
          <span className="font-mono text-xs bg-muted px-1 rounded">animated</span> (framer-motion).
          Icons without animated variants show a dash.
        </p>
      </div>
      <IconsShowcase />
    </div>
  );
}
