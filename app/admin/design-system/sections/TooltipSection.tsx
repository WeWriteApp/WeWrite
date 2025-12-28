"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  SimpleTooltip,
} from '../../../components/ui/tooltip';
import { ComponentShowcase, StateDemo } from './shared';

export function TooltipSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Tooltip"
      path="app/components/ui/tooltip.tsx"
      description="Accessible tooltips for displaying additional information on hover. Uses Radix UI primitives for proper keyboard and screen reader support. TooltipProvider is already wrapped at the app level."
    >
      <StateDemo label="Variants">
        <SimpleTooltip content="Primary variant (accent color)" variant="primary">
          <Button variant="default">Primary</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Secondary variant (neutral)" variant="secondary">
          <Button variant="secondary">Secondary</Button>
        </SimpleTooltip>
      </StateDemo>

      <StateDemo label="SimpleTooltip (Recommended)">
        <SimpleTooltip content="This is a tooltip">
          <Button variant="outline">Hover me</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Another tooltip message">
          <Button variant="secondary">Or me</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Icon tooltips work great">
          <Button variant="ghost" size="icon">
            <Icon name="Info" size={16} />
          </Button>
        </SimpleTooltip>
      </StateDemo>

      <StateDemo label="Positioning">
        <SimpleTooltip content="Above" side="top">
          <Button variant="outline" size="sm">Top</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Below" side="bottom">
          <Button variant="outline" size="sm">Bottom</Button>
        </SimpleTooltip>
        <SimpleTooltip content="To the left" side="left">
          <Button variant="outline" size="sm">Left</Button>
        </SimpleTooltip>
        <SimpleTooltip content="To the right" side="right">
          <Button variant="outline" size="sm">Right</Button>
        </SimpleTooltip>
      </StateDemo>

      <StateDemo label="Alignment">
        <SimpleTooltip content="Aligned to start" side="bottom" align="start">
          <Button variant="outline" size="sm">Start</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Aligned to center" side="bottom" align="center">
          <Button variant="outline" size="sm">Center</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Aligned to end" side="bottom" align="end">
          <Button variant="outline" size="sm">End</Button>
        </SimpleTooltip>
      </StateDemo>

      <StateDemo label="Delay Duration">
        <SimpleTooltip content="Instant (0ms)" delayDuration={0}>
          <Button variant="outline" size="sm">Instant</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Default (200ms)" delayDuration={200}>
          <Button variant="outline" size="sm">Default</Button>
        </SimpleTooltip>
        <SimpleTooltip content="Slow (500ms)" delayDuration={500}>
          <Button variant="outline" size="sm">Slow</Button>
        </SimpleTooltip>
      </StateDemo>

      <StateDemo label="Rich Content">
        <SimpleTooltip
          content={
            <div className="flex items-center gap-2">
              <Icon name="Star" size={14} className="text-yellow-400" />
              <span>Featured content</span>
            </div>
          }
        >
          <Button variant="outline">Rich tooltip</Button>
        </SimpleTooltip>
        <SimpleTooltip
          content={
            <div className="max-w-xs">
              <div className="font-medium">Multi-line tooltip</div>
              <div className="text-muted-foreground">
                Tooltips can contain multiple lines and rich content.
              </div>
            </div>
          }
        >
          <Button variant="outline">Multi-line</Button>
        </SimpleTooltip>
      </StateDemo>

      <StateDemo label="Composable API (Advanced)">
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <Button variant="outline">Composable</Button>
          </TooltipTrigger>
          <TooltipContent>
            Using the composable API for full control
          </TooltipContent>
        </Tooltip>
      </StateDemo>

      <StateDemo label="Common Use Cases">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Status</span>
            <SimpleTooltip content="This page is publicly visible">
              <span>
                <Icon name="Globe" size={14} className="text-muted-foreground cursor-help" />
              </span>
            </SimpleTooltip>
          </div>

          <SimpleTooltip content="Edit this item">
            <Button variant="ghost" size="icon">
              <Icon name="Pencil" size={16} />
            </Button>
          </SimpleTooltip>

          <SimpleTooltip content="Copy to clipboard">
            <Button variant="ghost" size="icon">
              <Icon name="Copy" size={16} />
            </Button>
          </SimpleTooltip>

          <SimpleTooltip content="Delete permanently">
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
              <Icon name="Trash2" size={16} />
            </Button>
          </SimpleTooltip>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
