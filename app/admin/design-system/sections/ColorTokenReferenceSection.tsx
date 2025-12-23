"use client";

import React from 'react';
import { ComponentShowcase, StateDemo } from './shared';

export function ColorTokenReferenceSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Color Token Reference"
      path="app/globals.css"
      description="How to use color tokens in Tailwind classes throughout the codebase"
    >
      <div className="space-y-6">
        {/* Primary/Accent Colors */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Primary (Accent) Colors</h4>
          <p className="text-sm text-muted-foreground">
            The primary color is used for interactive elements, links, and emphasis. Use opacity variants for subtle fills.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="space-y-1">
              <div className="h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">primary</div>
              <code className="text-muted-foreground">bg-primary</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-primary-20 rounded flex items-center justify-center">primary-20</div>
              <code className="text-muted-foreground">bg-primary-20</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-primary-10 rounded flex items-center justify-center">primary-10</div>
              <code className="text-muted-foreground">bg-primary-10</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-primary-5 rounded flex items-center justify-center">primary-5</div>
              <code className="text-muted-foreground">bg-primary-5</code>
            </div>
          </div>
        </div>

        {/* Neutral Solid Colors */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Neutral Solid Colors</h4>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Solid colors</strong> are opaque fills derived from the primary hue with low chroma (oklch).
            Use <code className="bg-muted px-1 rounded">neutral-solid-{'{N}'}</code> when you need a consistent, opaque background
            that doesn't allow content behind it to show through.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="space-y-1">
              <div className="h-8 bg-neutral-solid-30 rounded flex items-center justify-center">30%</div>
              <code className="text-muted-foreground">bg-neutral-solid-30</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-solid-20 rounded flex items-center justify-center">20%</div>
              <code className="text-muted-foreground">bg-neutral-solid-20</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-solid-15 rounded flex items-center justify-center">15%</div>
              <code className="text-muted-foreground">bg-neutral-solid-15</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-solid-10 rounded flex items-center justify-center">10%</div>
              <code className="text-muted-foreground">bg-neutral-solid-10</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-solid-5 rounded flex items-center justify-center">5%</div>
              <code className="text-muted-foreground">bg-neutral-solid-5</code>
            </div>
          </div>
        </div>

        {/* Neutral Alpha Colors */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Neutral Alpha Colors</h4>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Alpha colors</strong> are transparent overlays (rgba) that adapt to light/dark mode.
            In light mode they use black, in dark mode they use white. Use <code className="bg-muted px-1 rounded">neutral-alpha-{'{N}'}</code>
            when you want content behind to show through or for hover/overlay effects.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="space-y-1">
              <div className="h-8 bg-neutral-alpha-30 rounded flex items-center justify-center">30%</div>
              <code className="text-muted-foreground">bg-neutral-alpha-30</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-alpha-20 rounded flex items-center justify-center">20%</div>
              <code className="text-muted-foreground">bg-neutral-alpha-20</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-alpha-15 rounded flex items-center justify-center">15%</div>
              <code className="text-muted-foreground">bg-neutral-alpha-15</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-alpha-10 rounded flex items-center justify-center">10%</div>
              <code className="text-muted-foreground">bg-neutral-alpha-10</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-neutral-alpha-5 rounded flex items-center justify-center">5%</div>
              <code className="text-muted-foreground">bg-neutral-alpha-5</code>
            </div>
          </div>
          <div className="wewrite-card p-4 bg-muted/30 mt-3">
            <p className="text-sm font-medium mb-2">Solid vs Alpha - When to use which:</p>
            <div className="text-sm space-y-1">
              <p><strong className="text-success">Solid:</strong> Card backgrounds, buttons, chips - opaque fills that cover content</p>
              <p><strong className="text-primary">Alpha:</strong> Hover states, overlays, glassmorphism - transparent effects</p>
            </div>
          </div>
        </div>

        {/* Semantic Colors */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Semantic Colors</h4>
          <p className="text-sm text-muted-foreground">
            Success and error colors with opacity variants for backgrounds and subtle fills.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="space-y-1">
              <div className="h-8 bg-success rounded flex items-center justify-center text-white">success</div>
              <code className="text-muted-foreground">bg-success</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-success-10 rounded flex items-center justify-center text-success">success-10</div>
              <code className="text-muted-foreground">bg-success-10</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-error rounded flex items-center justify-center text-white">error</div>
              <code className="text-muted-foreground">bg-error</code>
            </div>
            <div className="space-y-1">
              <div className="h-8 bg-error-10 rounded flex items-center justify-center text-error">error-10</div>
              <code className="text-muted-foreground">bg-error-10</code>
            </div>
          </div>
        </div>

        {/* Common Patterns */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Common Patterns</h4>
          <div className="wewrite-card p-4 space-y-3 bg-muted/30">
            <div className="text-sm space-y-2">
              <p><strong>Solid buttons (primary/success/error):</strong> <code className="bg-muted px-1 rounded">bg-primary hover:alpha-10 active:alpha-15</code></p>
              <p><strong>Secondary buttons:</strong> <code className="bg-muted px-1 rounded">bg-neutral-solid-10 hover:alpha-10 active:alpha-15</code></p>
              <p><strong>Outline buttons:</strong> <code className="bg-muted px-1 rounded">border border-neutral-alpha-20 hover:bg-neutral-alpha-5</code></p>
              <p><strong>Ghost buttons:</strong> <code className="bg-muted px-1 rounded">hover:bg-neutral-alpha-5 active:bg-neutral-alpha-10</code></p>
              <p><strong>Cards:</strong> <code className="bg-muted px-1 rounded">bg-card border border-border</code></p>
              <p><strong>Active chips:</strong> <code className="bg-muted px-1 rounded">bg-primary-10 text-primary</code></p>
              <p><strong>Inactive chips:</strong> <code className="bg-muted px-1 rounded">bg-neutral-solid-10 text-foreground</code></p>
              <p><strong>Success-secondary hover:</strong> <code className="bg-muted px-1 rounded">bg-success-10 hover:success-alpha-10</code></p>
              <p><strong>Destructive-secondary hover:</strong> <code className="bg-muted px-1 rounded">bg-error-10 hover:error-alpha-10</code></p>
            </div>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  );
}
