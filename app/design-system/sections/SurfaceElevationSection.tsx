"use client";

import React from 'react';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsNote } from './shared';

/**
 * Surface & Elevation Design System Documentation
 *
 * Documents the layered surface system: background, card, popover,
 * and the wewrite-card glassmorphism variant. Helps developers choose
 * the correct background for any container.
 */
export function SurfaceElevationSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Surface & Elevation"
      path="app/globals.css, app/styles/card-theme.css"
      description="Layered background system for pages, cards, drawers, and overlays"
    >
      {/* Visual stack */}
      <StateDemo label="Surface Hierarchy">
        <div className="w-full max-w-lg space-y-0">
          {/* Background */}
          <div className="bg-background border border-border rounded-t-xl p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold">bg-background</p>
                <p className="text-xs text-muted-foreground">Page body, sidebars</p>
              </div>
              <code className="text-xs text-muted-foreground">--background</code>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted">Light: white</span>
              <span className="px-2 py-0.5 rounded bg-muted">Dark: black</span>
            </div>
          </div>

          {/* Card */}
          <div className="bg-card border-x border-border p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold">bg-card</p>
                <p className="text-xs text-muted-foreground">Drawers, dialogs, solid cards</p>
              </div>
              <code className="text-xs text-muted-foreground">--card</code>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted">Light: white</span>
              <span className="px-2 py-0.5 rounded bg-muted">Dark: #262626</span>
            </div>
          </div>

          {/* Popover */}
          <div className="bg-popover border-x border-border p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold">bg-popover</p>
                <p className="text-xs text-muted-foreground">Dropdowns, tooltips, popovers</p>
              </div>
              <code className="text-xs text-muted-foreground">--popover</code>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted">Light: white</span>
              <span className="px-2 py-0.5 rounded bg-muted">Dark: #1A1A1A</span>
            </div>
          </div>

          {/* Muted */}
          <div className="bg-muted border-x border-b border-border rounded-b-xl p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold">bg-muted</p>
                <p className="text-xs text-muted-foreground">Inset surfaces, input backgrounds</p>
              </div>
              <code className="text-xs text-muted-foreground">--muted</code>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-background">Light: #F2F2F2</span>
              <span className="px-2 py-0.5 rounded bg-background">Dark: #383838</span>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Glassmorphism variant */}
      <StateDemo label="Glassmorphism (wewrite-card)">
        <div className="w-full max-w-lg">
          <div className="wewrite-card">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold">.wewrite-card</p>
                <p className="text-xs text-muted-foreground">Semi-transparent with backdrop blur</p>
              </div>
              <code className="text-xs text-muted-foreground">--card-bg</code>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted">Light: 70% white overlay</span>
              <span className="px-2 py-0.5 rounded bg-muted">Dark: 6% white overlay</span>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Decision guide */}
      <DocsNote variant="tip" title="Which surface to use?">
        <div className="text-sm space-y-2">
          <p><strong className="text-foreground">bg-background</strong> &mdash; Page body behind everything. Only use for the root page container.</p>
          <p><strong className="text-foreground">bg-card</strong> &mdash; Elevated opaque surfaces: drawers, modals, dialog content, sheet panels. Differentiates from page background in dark mode.</p>
          <p><strong className="text-foreground">.wewrite-card</strong> &mdash; Content cards within a page. Glassmorphic (semi-transparent + blur). Use for inline cards, not full-screen containers.</p>
          <p><strong className="text-foreground">bg-popover</strong> &mdash; Small floating UI: dropdown menus, tooltips, combobox lists.</p>
          <p><strong className="text-foreground">bg-muted</strong> &mdash; Recessed/inset areas: section backgrounds, input fields, chip groups.</p>
        </div>
      </DocsNote>

      {/* Common mistakes */}
      <CollapsibleDocs type="guidelines" title="Common Mistakes">
        <div className="text-sm space-y-2">
          <p><strong className="text-error">bg-background on drawers:</strong> In dark mode, drawers blend into the black page background. Use <code className="bg-muted px-1 rounded">bg-card</code> instead for visible elevation.</p>
          <p><strong className="text-error">wewrite-card on full-screen overlays:</strong> The glassmorphic blur is designed for inline cards, not full-screen containers. Use <code className="bg-muted px-1 rounded">bg-card</code> for drawers and dialogs.</p>
          <p><strong className="text-error">bg-muted for cards:</strong> Muted is for recessed areas (lower than background), not elevated surfaces. Use <code className="bg-muted px-1 rounded">bg-card</code> or <code className="bg-muted px-1 rounded">.wewrite-card</code> for elevated content.</p>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
