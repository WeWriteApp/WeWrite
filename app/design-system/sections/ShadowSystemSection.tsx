"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';

export function ShadowSystemSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Shadow System"
      path="app/globals.css"
      description="Two shadow modes: Normal (neutral) for general use, and Styled (color-matched) for colored buttons where the shadow should match the button color."
    >
      <StateDemo label="Normal Shadows (Tailwind)">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-background shadow-sm border border-border/50" />
            <code className="text-xs text-muted-foreground">shadow-sm</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-background shadow-md border border-border/50" />
            <code className="text-xs text-muted-foreground">shadow-md</code>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-background shadow-lg border border-border/50" />
            <code className="text-xs text-muted-foreground">shadow-lg</code>
          </div>
          <p className="text-sm text-muted-foreground self-center ml-2">
            Neutral black/gray shadows. Use for cards, surfaces, dropdowns.
          </p>
        </div>
      </StateDemo>

      <StateDemo label="Styled Shadows (Color-Matched)">
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="default" className="shadow-styled-primary">Primary</Button>
          <Button variant="success" className="shadow-styled-success">Success</Button>
          <Button variant="destructive" className="shadow-styled-error">Destructive</Button>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Shadow color matches the button color. Always visible (no shiny mode required).
        </p>
      </StateDemo>

      <StateDemo label="Icon Buttons with Styled Shadows">
        <div className="flex flex-wrap gap-3 items-center">
          <Button size="icon-sm" variant="success" className="shadow-styled-success">
            <Icon name="Check" size={16} />
          </Button>
          <Button size="icon-sm" variant="default" className="shadow-styled-primary">
            <Icon name="Plus" size={16} />
          </Button>
          <Button size="icon-sm" variant="destructive" className="shadow-styled-error">
            <Icon name="X" size={16} />
          </Button>
          <Button size="icon-sm" variant="secondary">
            <Icon name="RotateCcw" size={16} />
          </Button>
          <p className="text-sm text-muted-foreground ml-2">
            Icon buttons — styled shadow on colored, normal on neutral.
          </p>
        </div>
      </StateDemo>

      <StateDemo label="Usage Guide">
        <div className="wewrite-card p-4 max-w-2xl space-y-4">
          <h4 className="font-medium">When to Use Each</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <span className="font-medium text-foreground">Normal shadow</span> (Tailwind <code className="bg-muted px-1 rounded">shadow-sm</code>, <code className="bg-muted px-1 rounded">shadow-md</code>, etc.)
              <p className="mt-1 ml-4">For cards, surfaces, dropdowns, and neutral/secondary buttons. Shadow is always black/gray.</p>
            </li>
            <li>
              <span className="font-medium text-foreground">Styled shadow</span> (<code className="bg-muted px-1 rounded">.shadow-styled-primary</code>, <code className="bg-muted px-1 rounded">.shadow-styled-success</code>, <code className="bg-muted px-1 rounded">.shadow-styled-error</code>)
              <p className="mt-1 ml-4">For colored buttons where the shadow should reinforce the button&apos;s color. A green button gets a green shadow, a red button gets a red shadow.</p>
            </li>
          </ul>

          <h4 className="font-medium mt-4">CSS Classes</h4>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded font-mono space-y-1">
            <p>.shadow-styled-primary — blue shadow (for default/primary buttons)</p>
            <p>.shadow-styled-success — green shadow (for success buttons)</p>
            <p>.shadow-styled-error — red shadow (for destructive buttons)</p>
          </div>

          <h4 className="font-medium mt-4">States</h4>
          <p className="text-sm text-muted-foreground">
            Each styled shadow class includes <code className="bg-muted px-1 rounded">:hover</code> (larger glow) and <code className="bg-muted px-1 rounded">:active</code> (pressed inset) states automatically.
          </p>

          <h4 className="font-medium mt-4">Relationship to Shiny Mode</h4>
          <p className="text-sm text-muted-foreground">
            The <em>Shiny Button System</em> also provides color-matched shadows, but only when shiny mode is enabled by the user. Styled shadows are <strong>always visible</strong> regardless of mode, making them the right choice when a colored shadow is part of the core design rather than a decorative enhancement.
          </p>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
