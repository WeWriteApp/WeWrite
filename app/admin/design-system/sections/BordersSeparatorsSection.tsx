"use client";

import React from 'react';
import { ComponentShowcase, StateDemo } from './shared';

export function BordersSeparatorsSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Borders & Separators"
      path="Tailwind CSS classes"
      description="Border and separator patterns for visual hierarchy and content organization. Use border-border for standard borders that adapt to theme."
    >
      {/* Documentation */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-4">
        <h4 className="font-semibold text-sm">Usage Guidelines</h4>
        <div className="text-sm space-y-2 text-muted-foreground">
          <p><code className="bg-muted px-1 py-0.5 rounded text-xs">border-border</code> - Standard border color that adapts to light/dark theme. Use for card edges, dividers, and input borders.</p>
          <p><code className="bg-muted px-1 py-0.5 rounded text-xs">border-b border-border</code> - Bottom border for horizontal separators between sections.</p>
          <p><code className="bg-muted px-1 py-0.5 rounded text-xs">divide-y divide-border</code> - Apply to parent to add borders between child elements (great for lists).</p>
          <p><code className="bg-muted px-1 py-0.5 rounded text-xs">ring-1 ring-border</code> - Subtle outline effect, useful for focus states or grouping.</p>
        </div>
      </div>

      <StateDemo label="Horizontal Separators">
        <div className="w-full space-y-4">
          {/* Standard hr */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Standard &lt;hr /&gt; element</p>
            <hr className="border-border" />
          </div>

          {/* Border-bottom pattern */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">border-b border-border (on a div)</p>
            <div className="border-b border-border pb-4">
              <p className="text-sm">Content above the separator</p>
            </div>
            <p className="text-sm pt-2">Content below the separator</p>
          </div>

          {/* Dashed border */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">border-b border-dashed border-border</p>
            <div className="border-b border-dashed border-border pb-4">
              <p className="text-sm">Dashed separator - useful for less prominent divisions</p>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Card Borders">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Standard border */}
          <div className="p-4 border border-border rounded-lg">
            <p className="text-sm font-medium">border border-border rounded-lg</p>
            <p className="text-xs text-muted-foreground mt-1">Standard card border</p>
          </div>

          {/* Ring border */}
          <div className="p-4 ring-1 ring-border rounded-lg">
            <p className="text-sm font-medium">ring-1 ring-border rounded-lg</p>
            <p className="text-xs text-muted-foreground mt-1">Ring border (sharper)</p>
          </div>

          {/* Double border effect */}
          <div className="p-4 border-2 border-border rounded-lg">
            <p className="text-sm font-medium">border-2 border-border</p>
            <p className="text-xs text-muted-foreground mt-1">Thicker border for emphasis</p>
          </div>

          {/* Shadow + border */}
          <div className="p-4 border border-border rounded-lg shadow-sm">
            <p className="text-sm font-medium">border + shadow-sm</p>
            <p className="text-xs text-muted-foreground mt-1">Combined for depth</p>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="List Dividers (divide-y)">
        <div className="w-full">
          <p className="text-xs text-muted-foreground mb-2">Apply divide-y divide-border to parent element</p>
          <div className="border border-border rounded-lg divide-y divide-border">
            <div className="p-3">
              <p className="text-sm font-medium">List Item 1</p>
              <p className="text-xs text-muted-foreground">Description text</p>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium">List Item 2</p>
              <p className="text-xs text-muted-foreground">Description text</p>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium">List Item 3</p>
              <p className="text-xs text-muted-foreground">Description text</p>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Section Header Pattern">
        <div className="w-full space-y-4">
          {/* Pattern 1: Border below header */}
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold">Section Title</h3>
            <p className="text-sm text-muted-foreground">border-b border-border pb-4 on container</p>
          </div>

          {/* Pattern 2: Border with flex line */}
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold whitespace-nowrap">Section Title</h3>
            <div className="flex-1 border-b border-border"></div>
          </div>

          {/* Pattern 3: Centered text divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Vertical Separators">
        <div className="w-full">
          <p className="text-xs text-muted-foreground mb-2">Use border-l or border-r for vertical dividers</p>
          <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold">24</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div className="border-l border-border h-12"></div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold">128</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="border-l border-border h-12"></div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold">$42</p>
              <p className="text-xs text-muted-foreground">Earned</p>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Focus & Interactive States">
        <div className="w-full space-y-4">
          <p className="text-xs text-muted-foreground">Borders for interactive elements</p>
          <div className="flex flex-wrap gap-4">
            <div className="p-4 border border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <p className="text-sm">hover:border-primary</p>
            </div>
            <div className="p-4 border-2 border-primary rounded-lg">
              <p className="text-sm">border-2 border-primary (selected)</p>
            </div>
            <div className="p-4 border border-border rounded-lg ring-2 ring-primary ring-offset-2">
              <p className="text-sm">ring-2 ring-primary ring-offset-2</p>
            </div>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
