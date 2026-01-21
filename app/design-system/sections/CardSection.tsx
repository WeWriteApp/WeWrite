"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

/**
 * Card Design System Documentation
 *
 * Documents the wewrite-card CSS class and the modifiers actually used in the codebase.
 */
export function CardSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Card"
      path="app/styles/card-theme.css"
      description="Glassmorphic container with backdrop blur and subtle border"
    >
      {/* Base Card */}
      <StateDemo label="Base Card">
        <div className="w-full max-w-md">
          <div className="wewrite-card">
            <p className="text-sm">
              The <code>.wewrite-card</code> class provides glassmorphism with semi-transparent background, backdrop blur, and subtle border. This is the only card class you need for most cases.
            </p>
          </div>
        </div>
      </StateDemo>

      {/* Common Modifiers */}
      <StateDemo label="Common Modifiers">
        <div className="w-full space-y-3">
          {/* No Padding */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Edge-to-edge content:</p>
            <div className="wewrite-card wewrite-card-no-padding max-w-md">
              <div className="bg-muted/50 p-4 text-center">
                <span className="text-xs font-mono">wewrite-card-no-padding</span>
              </div>
            </div>
          </div>

          {/* Small Padding */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Compact cards:</p>
            <div className="wewrite-card wewrite-card-padding-sm max-w-md text-center">
              <span className="text-xs font-mono">wewrite-card-padding-sm</span>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Floating Variant */}
      <StateDemo label="Floating Variant">
        <div className="w-full max-w-md">
          <div className="wewrite-card wewrite-floating">
            <div className="flex items-center gap-2">
              <Icon name="Layers" size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">wewrite-floating</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Used for: dropdowns, popovers, text selection menus, allocation bar
            </p>
          </div>
        </div>
      </StateDemo>

      {/* Fixed Headers Pattern */}
      <StateDemo label="Fixed Header Pattern">
        <div className="w-full max-w-md">
          <div className="wewrite-card wewrite-card-sharp wewrite-card-border-bottom wewrite-card-no-padding">
            <div className="flex items-center gap-2 p-3">
              <Icon name="LayoutTemplate" size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">Fixed Header Style</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <code>wewrite-card-sharp</code> + <code>wewrite-card-border-bottom</code> + <code>wewrite-card-no-padding</code>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Used for: UserProfileHeader, FinancialHeader
          </p>
        </div>
      </StateDemo>

      {/* Interactive States */}
      <StateDemo label="Interactive States">
        <div className="w-full max-w-md">
          <div className="wewrite-card cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="MousePointer" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Hover this card</span>
              </div>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Add <code>hover:bg-[var(--card-bg-hover)]</code> for clickable cards
          </p>
        </div>
      </StateDemo>

      {/* Usage Guidelines */}
      <CollapsibleDocs type="usage">
        <div className="text-sm space-y-2">
          <p><strong>Default:</strong> Just use <code>.wewrite-card</code></p>
          <p><strong>Edge-to-edge content:</strong> Add <code>wewrite-card-no-padding</code></p>
          <p><strong>Floating UI:</strong> Add <code>wewrite-floating</code></p>
          <p><strong>Fixed headers:</strong> Combine <code>wewrite-card-sharp</code> + <code>wewrite-card-border-bottom</code></p>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
