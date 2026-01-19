"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { CompositionBar } from '../../components/payments/CompositionBar';
import { ComponentShowcase, StateDemo } from './shared';

export function ActivityCardSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Activity Card"
      path="app/components/activity/ActivityCard.tsx"
      description="Displays page edit activity with diff preview, author info, and allocation controls. Hover over sections to see their names."
    >
      <StateDemo label="Card Anatomy">
        <div className="w-full max-w-md">
          <div className="wewrite-card p-3">
            {/* Header Section */}
            <div className="flex justify-between items-start w-full mb-3 p-2 border border-dashed border-primary/50 rounded-lg relative">
              <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-primary font-medium">Header Section</span>
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="bg-primary-10 text-primary px-2 py-0.5 rounded-lg text-xs font-medium">Example Page Title</span>
                  <span className="text-foreground whitespace-nowrap">edited by</span>
                  <span className="text-primary">username</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">2 hours ago</span>
              </div>
            </div>

            {/* Diff Section */}
            <div className="mb-3 p-2 border border-dashed border-green-500/50 rounded-lg relative">
              <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-green-600 dark:text-green-400 font-medium">Diff Section</span>
              {/* Light mode: outlined, Dark mode: filled (additive) */}
              <div className="border border-border dark:border-transparent bg-neutral-alpha-dark-10 rounded-lg p-3 relative">
                {/* Diff count at top right */}
                <div className="absolute top-2 right-3">
                  <span className="text-xs font-medium flex items-center gap-1">
                    <span className="text-green-600 dark:text-green-400">+42</span>
                    <span className="text-red-600 dark:text-red-400">-8</span>
                  </span>
                </div>
                <div className="text-xs overflow-hidden pr-16">
                  <span className="text-muted-foreground">...existing content </span>
                  <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-0.5 rounded line-through">old text</span>
                  <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-0.5 rounded">new text added here</span>
                  <span className="text-muted-foreground"> more content...</span>
                </div>
              </div>
            </div>

            {/* Allocation Section */}
            <div className="p-2 border border-dashed border-blue-500/50 rounded-lg relative">
              <span className="absolute -top-2 left-2 text-[10px] bg-background px-1 text-blue-600 dark:text-blue-400 font-medium">Allocation Section</span>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Icon name="Minus" size={16} />
                </Button>
                <CompositionBar
                  data={{ otherPagesPercentage: 15, currentPageFundedPercentage: 25, currentPageOverfundedPercentage: 0, availablePercentage: 60, isOutOfFunds: false }}
                  size="md"
                />
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0 flex-shrink-0 border border-neutral-20">
                  <Icon name="Plus" size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Section Descriptions">
        <div className="wewrite-card p-4 max-w-2xl">
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <strong className="text-foreground">Header Section:</strong> Page title (PillLink), action verb (created/edited/renamed), author (UsernameBadge with subscription tier), and relative timestamp with full date tooltip.
            </li>
            <li>
              <strong className="text-foreground">Diff Section:</strong> Inner card with different styling per mode:
              <ul className="ml-4 mt-1 space-y-1">
                <li>• <strong>Light mode:</strong> Outlined with <code className="bg-muted px-1 rounded">border-border</code></li>
                <li>• <strong>Dark mode:</strong> Filled with <code className="bg-muted px-1 rounded">bg-neutral-alpha-dark-10</code> (additive white overlay)</li>
                <li>• <strong>DiffStats:</strong> Character count changes (+X / -Y format) positioned at top right</li>
                <li>• <strong>DiffPreview:</strong> Context text with green additions and red strikethrough deletions</li>
              </ul>
            </li>
            <li>
              <strong className="text-foreground">Allocation Section:</strong> Token allocation slider and controls for supporting the page author. Only shown when viewing other users' pages.
            </li>
            <li>
              <strong className="text-foreground">Restore Section (conditional):</strong> Button to restore page to this version. Only shown on version history pages when user owns the page.
            </li>
          </ul>
        </div>
      </StateDemo>

      <StateDemo label="Diff Styling Reference">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Added text:</p>
            <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1 rounded text-sm">+new content</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Removed text:</p>
            <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1 rounded line-through text-sm">-old content</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Context:</p>
            <span className="text-muted-foreground text-sm">...surrounding text...</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Code Usage">
        <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
          <pre className="text-xs overflow-x-auto">
{`<ActivityCard
  activity={{
    pageId: "abc123",
    pageName: "Example Page",
    userId: "user123",
    username: "jamie",
    timestamp: "2024-01-15T10:30:00Z",
    currentContent: "...",
    previousContent: "...",
    diff: { added: 42, removed: 8, hasChanges: true }
  }}
  isCarousel={false}
  compactLayout={false}
/>`}
          </pre>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
