"use client";

import React from 'react';
import { WarningDot } from '../../components/ui/warning-dot';
import { ComponentShowcase, StateDemo } from './shared';

export function WarningDotSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Warning Dot"
      path="app/components/ui/warning-dot.tsx"
      description="Animated indicator dot for signaling warnings, errors, or critical states. Positioned relative to parent elements for badges, icons, and menu items."
    >
      <StateDemo label="Variants">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">A</div>
              <WarningDot variant="info" position="top-right" offset={{ top: '-4px', right: '-4px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Info</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">B</div>
              <WarningDot variant="warning" position="top-right" offset={{ top: '-4px', right: '-4px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">C</div>
              <WarningDot variant="error" position="top-right" offset={{ top: '-4px', right: '-4px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Error</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">D</div>
              <WarningDot variant="critical" position="top-right" offset={{ top: '-4px', right: '-4px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Critical</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Sizes">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">S</div>
              <WarningDot size="sm" position="top-right" offset={{ top: '-3px', right: '-3px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Small</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">M</div>
              <WarningDot size="md" position="top-right" offset={{ top: '-4px', right: '-4px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">L</div>
              <WarningDot size="lg" position="top-right" offset={{ top: '-5px', right: '-5px' }} />
            </div>
            <span className="text-sm text-muted-foreground">Large</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Positions">
        <div className="flex items-center gap-8">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs">TL</div>
            <WarningDot position="top-left" offset={{ top: '-4px', left: '-4px' }} />
          </div>
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs">TR</div>
            <WarningDot position="top-right" offset={{ top: '-4px', right: '-4px' }} />
          </div>
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs">BL</div>
            <WarningDot position="bottom-left" offset={{ bottom: '-4px', left: '-4px' }} />
          </div>
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs">BR</div>
            <WarningDot position="bottom-right" offset={{ bottom: '-4px', right: '-4px' }} />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Static (No Animation)">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm">X</div>
            <WarningDot animate={false} position="top-right" offset={{ top: '-4px', right: '-4px' }} />
          </div>
          <span className="text-sm text-muted-foreground">animate=false</span>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
