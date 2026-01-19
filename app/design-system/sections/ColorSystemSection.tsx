"use client";

import React from 'react';
import ColorSystemManager from '@/components/settings/ColorSystemManager';
import ThemeToggle from '../../components/utils/ThemeToggle';

export function ColorSystemSection({ id }: { id: string }) {
  return (
    <div id={id} className="wewrite-card space-y-4 scroll-mt-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Color System Controls</h3>
            <p className="text-sm text-muted-foreground">app/components/settings/ColorSystemManager.tsx</p>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust accent, neutral, and background colors to test how all components look with different color schemes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">Theme:</div>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <ColorSystemManager />
      </div>
    </div>
  );
}
