"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { ComponentShowcase, StateDemo } from './shared';
import {
  CONTENT_PAGE_VISIBILITY,
  PAGE_STATE_LABELS,
  type PageState,
  type VisibilityRule
} from '../../config/contentPageVisibility';

/**
 * Visibility Cell Component
 * Renders a cell in the visibility table with appropriate styling
 */
function VisibilityCell({ value, condition }: { value: boolean | 'conditional'; condition?: string }) {
  if (value === true) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center" title="Visible">
          <Icon name="Check" size={14} className="text-green-500" />
        </div>
      </div>
    );
  }

  if (value === false) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center" title="Hidden">
          <Icon name="X" size={14} className="text-red-500" />
        </div>
      </div>
    );
  }

  // Conditional
  return (
    <div className="flex items-center justify-center">
      <div
        className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center cursor-help"
        title={condition || 'Conditional visibility'}
      >
        <Icon name="HelpCircle" size={14} className="text-yellow-500" />
      </div>
    </div>
  );
}

/**
 * Visibility Table Component
 * Displays the visibility matrix from the config file
 */
function VisibilityTable() {
  const pageStates: PageState[] = ['myPageSaved', 'myPageNew', 'otherPage'];

  // Group rules by category
  const categories = [
    { name: 'Header Elements', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['contentPageHeader', 'titleEditable', 'backButton'].includes(r.id)) },
    { name: 'Save/Edit Controls', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['stickySaveHeader', 'autoSaveIndicator'].includes(r.id)) },
    { name: 'Content Area', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['contentDisplay', 'contentEditable', 'denseModeToggle', 'writingIdeasBanner'].includes(r.id)) },
    { name: 'Footer/Metadata', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['contentPageFooter', 'locationField', 'customDateField'].includes(r.id)) },
    { name: 'Page Connections', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['pageGraphView', 'whatLinksHere', 'replyToCard', 'repliesSection', 'relatedPagesSection'].includes(r.id)) },
    { name: 'Bottom Actions', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['addToPageButton', 'deleteButton', 'cancelButton'].includes(r.id)) },
    { name: 'Floating Elements', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['allocationBar', 'emptyLinesAlert', 'deletedPageBanner'].includes(r.id)) },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-semibold">Element</th>
            {pageStates.map(state => (
              <th key={state} className="text-center py-2 px-3 font-semibold whitespace-nowrap">
                {PAGE_STATE_LABELS[state]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map(category => (
            <React.Fragment key={category.name}>
              {/* Category Header */}
              <tr className="bg-muted/30">
                <td colSpan={4} className="py-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {category.name}
                </td>
              </tr>
              {/* Category Rules */}
              {category.rules.map((rule, idx) => (
                <tr
                  key={rule.id}
                  className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
                >
                  <td className="py-2 px-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{rule.label}</span>
                      <span className="text-xs text-muted-foreground">{rule.description}</span>
                      {rule.condition && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5 italic">
                          {rule.condition}
                        </span>
                      )}
                    </div>
                  </td>
                  {pageStates.map(state => (
                    <td key={state} className="py-2 px-3">
                      <VisibilityCell
                        value={rule.visibility[state]}
                        condition={rule.condition}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <Icon name="Check" size={12} className="text-green-500" />
          </div>
          <span>Visible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
            <Icon name="X" size={12} className="text-red-500" />
          </div>
          <span>Hidden</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Icon name="HelpCircle" size={12} className="text-yellow-500" />
          </div>
          <span>Conditional (hover for details)</span>
        </div>
      </div>

      {/* Source of Truth Note */}
      <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <Icon name="Info" size={12} className="inline mr-1" />
          <strong>Source of Truth:</strong> This table is generated from{' '}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">app/config/contentPageVisibility.ts</code>.
          Edit that file to change visibility rules.
        </p>
      </div>
    </div>
  );
}

/**
 * ContentPage Design System Documentation
 *
 * High-level architecture and visibility rules for ContentPageView.
 * For page statistics (Views, Edits, Supporters), see the "Page Stats" section.
 */
export function ContentPageSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Content Page"
      path="app/components/pages/ContentPageView.tsx"
      description="The main page view component. For statistics cards, see Page Stats section."
    >
      {/* Visibility Matrix Table - THE SOURCE OF TRUTH */}
      <StateDemo label="Element Visibility Matrix">
        <VisibilityTable />
      </StateDemo>

      {/* Component Architecture */}
      <StateDemo label="Component Hierarchy">
        <div className="w-full">
          <div className="wewrite-card text-sm font-mono space-y-1">
            <div>ContentPageView</div>
            <div className="pl-4 text-muted-foreground">├─ ContentPageHeader</div>
            <div className="pl-4 text-muted-foreground">├─ ContentDisplay</div>
            <div className="pl-4 text-muted-foreground">├─ ContentPageFooter</div>
            <div className="pl-8 text-muted-foreground/70">├─ ContentPageActions</div>
            <div className="pl-8 text-muted-foreground/70">├─ CustomDateField</div>
            <div className="pl-8 text-muted-foreground/70">├─ LocationField</div>
            <div className="pl-8 text-muted-foreground/70">├─ ContentPageStats (see Page Stats)</div>
            <div className="pl-8 text-muted-foreground/70">└─ SameTitlePages</div>
            <div className="pl-4 text-muted-foreground">├─ PageGraphView</div>
            <div className="pl-4 text-muted-foreground">├─ WhatLinksHere</div>
            <div className="pl-4 text-muted-foreground">├─ RepliesSection</div>
            <div className="pl-4 text-muted-foreground">└─ AllocationBar (fixed)</div>
          </div>
        </div>
      </StateDemo>

      {/* Edit Mode Logic */}
      <StateDemo label="Edit Mode">
        <div className="w-full">
          <div className="wewrite-card">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Edit" size={16} className="text-muted-foreground" />
              <span className="font-semibold">Always-Edit Architecture</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Owners are always in edit mode. No toggle button.
            </p>
            <div className="p-2 bg-muted/50 rounded text-xs font-mono">
              canEdit = user.uid === page.userId && !showVersion && !showDiff
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Key Design Principles */}
      <StateDemo label="Design Principles">
        <div className="w-full">
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <Icon name="Check" size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span><strong>Hide empty sections</strong> - No &quot;No results&quot; cards</span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="Check" size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span><strong>Lazy load below fold</strong> - Graph, map, related pages</span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="Check" size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span><strong>Owner vs viewer</strong> - Controls based on ownership</span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="Check" size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span><strong>New page mode</strong> - Hide distractions until first save</span>
            </li>
          </ul>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
