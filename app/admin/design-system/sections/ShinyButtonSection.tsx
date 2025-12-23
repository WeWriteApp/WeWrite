"use client";

import React from 'react';
import { Button } from '../../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';

export function ShinyButtonSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Shiny Button System"
      path="app/globals.css + app/components/ui/button.tsx"
      description="Shimmer animation system using CSS class inheritance. Shimmer is invisible at rest and slides once on hover."
    >
      <StateDemo label="Shiny Buttons (hover me!)">
        <div className="flex flex-wrap gap-2">
          <Button className="shiny-shimmer-base shiny-glow-base button-shiny-style">Primary</Button>
          <Button variant="secondary" className="shiny-shimmer-base shiny-skeuomorphic-base button-secondary-shiny-style">Secondary</Button>
          <Button variant="outline" className="shiny-shimmer-base button-outline-shiny-style">Outline</Button>
          <Button variant="destructive" className="shiny-shimmer-base shiny-glow-base button-destructive-shiny-style">Destructive</Button>
          <Button variant="success" className="shiny-shimmer-base shiny-glow-base button-success-shiny-style">Success</Button>
        </div>
      </StateDemo>

      <StateDemo label="Light Variants (hover me!)">
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive-secondary" className="shiny-shimmer-base shiny-skeuomorphic-base button-destructive-secondary-shiny-style">Destructive Light</Button>
          <Button variant="success-secondary" className="shiny-shimmer-base shiny-skeuomorphic-base button-success-secondary-shiny-style">Success Light</Button>
        </div>
      </StateDemo>

      <StateDemo label="CSS Class Inheritance">
        <div className="wewrite-card p-4 max-w-2xl space-y-4">
          <h4 className="font-medium">Base Classes (in globals.css)</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <code className="bg-muted px-1 rounded font-mono">.shiny-shimmer-base</code>
              <p className="mt-1 ml-4">Provides the shimmer animation via ::before pseudo-element. Invisible at rest, slides left-to-right once on hover.</p>
            </li>
            <li>
              <code className="bg-muted px-1 rounded font-mono">.shiny-glow-base</code>
              <p className="mt-1 ml-4">Adds border glow and text shadow. Used for solid colored buttons (primary, destructive, success).</p>
            </li>
            <li>
              <code className="bg-muted px-1 rounded font-mono">.shiny-skeuomorphic-base</code>
              <p className="mt-1 ml-4">Adds inset shadows and gradient overlay. Used for light buttons (secondary, *-secondary variants).</p>
            </li>
          </ul>

          <h4 className="font-medium mt-4">Variant-Specific Classes</h4>
          <p className="text-sm text-muted-foreground mb-2">These only add color-specific box-shadows:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <code className="bg-muted px-1 rounded">.button-shiny-style</code> - Primary blue glow</li>
            <li>• <code className="bg-muted px-1 rounded">.button-destructive-shiny-style</code> - Red glow</li>
            <li>• <code className="bg-muted px-1 rounded">.button-success-shiny-style</code> - Green glow</li>
            <li>• <code className="bg-muted px-1 rounded">.button-secondary-shiny-style</code> - Subtle neutral glow</li>
            <li>• <code className="bg-muted px-1 rounded">.button-outline-shiny-style</code> - Border enhancement</li>
            <li>• <code className="bg-muted px-1 rounded">.button-destructive-secondary-shiny-style</code> - Light red glow</li>
            <li>• <code className="bg-muted px-1 rounded">.button-success-secondary-shiny-style</code> - Light green glow</li>
          </ul>

          <h4 className="font-medium mt-4">Composition Pattern</h4>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded font-mono space-y-1">
            <p>Solid buttons: shimmer + glow + color</p>
            <p className="text-xs opacity-75">shiny-shimmer-base shiny-glow-base button-shiny-style</p>
            <p className="mt-2">Light buttons: shimmer + skeuomorphic + color</p>
            <p className="text-xs opacity-75">shiny-shimmer-base shiny-skeuomorphic-base button-secondary-shiny-style</p>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
