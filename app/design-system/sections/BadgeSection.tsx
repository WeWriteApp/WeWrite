"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../components/ui/badge';
import { ComponentShowcase, StateDemo } from './shared';

export function BadgeSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Badge"
      path="app/components/ui/badge.tsx"
      description="Interactive status indicators and labels. NOTE: 'Chips' do not exist in our design system - use Badge for all pill-shaped indicators. In 'Shiny' UI mode (Settings > Appearance), badges automatically get skeuomorphic styling with shimmer effects on hover."
    >
      <StateDemo label="Interactive Variants (hover me!)">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="success-secondary">Success Light</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="destructive-secondary">Destructive Light</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="warning-secondary">Warning Light</Badge>
      </StateDemo>

      <StateDemo label="Static Variants (no interaction)">
        <Badge variant="default-static">Default</Badge>
        <Badge variant="secondary-static">Secondary</Badge>
        <Badge variant="outline-static">Outline</Badge>
        <Badge variant="success-static">Success</Badge>
        <Badge variant="destructive-static">Destructive</Badge>
        <Badge variant="warning-static">Warning</Badge>
      </StateDemo>

      <StateDemo label="Sizes">
        <Badge size="sm">Small</Badge>
        <Badge size="default">Default</Badge>
        <Badge size="lg">Large</Badge>
      </StateDemo>

      <StateDemo label="With Icons">
        <Badge><Icon name="Star" size={12} className="mr-1" />Featured</Badge>
        <Badge variant="secondary"><Icon name="Check" size={12} className="mr-1" />Verified</Badge>
        <Badge variant="success"><Icon name="Check" size={12} className="mr-1" />Success</Badge>
        <Badge variant="destructive"><Icon name="X" size={12} className="mr-1" />Error</Badge>
      </StateDemo>

      <StateDemo label="Usage Example (in shiny mode, these get shimmer effects)">
        <div className="text-lg text-muted-foreground">
          Join <Badge variant="secondary" className="mx-1 text-lg">112 writers</Badge>
          {' '}who've made{' '}
          <Badge variant="success" className="mx-1 text-lg">$146.70</Badge>
          {' '}helping to build humanity's shared knowledge.
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
