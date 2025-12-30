"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { ComponentShowcase, StateDemo } from './shared';
import {
  CONTENT_PAGE_VISIBILITY,
  PAGE_STATE_LABELS,
  type PageState,
  type VisibilityRule
} from '../../../config/contentPageVisibility';

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
    { name: 'Bottom Actions', rules: CONTENT_PAGE_VISIBILITY.filter(r => ['deleteButton', 'cancelButton'].includes(r.id)) },
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
          Edit that file to change visibility rules - changes will reflect here and in ContentPageView.
        </p>
      </div>
    </div>
  );
}

/**
 * ContentPage Design System Documentation
 *
 * This section documents the ContentPageView component and all its sub-sections,
 * including visibility rules, conditional rendering logic, and component hierarchy.
 */
export function ContentPageSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Content Page"
      path="app/components/pages/ContentPageView.tsx"
      description="The main page view component that displays user-created content pages with all related sections"
    >
      {/* Visibility Matrix Table - THE SOURCE OF TRUTH */}
      <StateDemo label="Element Visibility Matrix">
        <VisibilityTable />
      </StateDemo>

      {/* Component Architecture */}
      <StateDemo label="Component Architecture">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2">Main Components</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li><code>ContentPageView</code> - Main page container and state management</li>
              <li><code>ContentPageHeader</code> - Title, author, edit controls</li>
              <li><code>ContentDisplay</code> - Content editor/viewer</li>
              <li><code>ContentPageFooter</code> - Actions and metadata</li>
              <li><code>ContentPageStats</code> - Views, edits, supporters statistics</li>
            </ul>
          </div>
        </div>
      </StateDemo>

      {/* Edit Mode Logic */}
      <StateDemo label="Edit Mode Logic">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Edit" size={16} />
              Always-Edit Architecture
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><strong>Key principle:</strong> Owners are ALWAYS in edit mode on their own pages.</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>No manual toggle between view/edit modes</li>
                <li>Owner&apos;s page = always editable</li>
                <li>Other&apos;s page = always read-only</li>
                <li>Version/diff views = always read-only regardless of ownership</li>
              </ul>
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <code className="block">canEdit = user.uid === page.userId && !showVersion && !showDiff</code>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Content Page Stats */}
      <StateDemo label="ContentPageStats">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Eye" size={16} />
              Page Statistics Cards
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/pages/ContentPageStats.tsx</code></p>
              <p>Displays view count, recent edits, and supporters in a responsive grid.</p>
              <h5 className="font-medium mt-3">Loading State Behavior:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Cards show consistent <code>min-h-[52px]</code> during loading</li>
                <li>Loader icon replaces stat values during fetch</li>
                <li>No layout shift when content loads (same height skeleton)</li>
              </ul>
              <h5 className="font-medium mt-3">Grid Layout:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>2 columns by default (Views + Recent Edits)</li>
                <li>3 columns when supporters exist</li>
                <li>Includes 24h sparkline charts</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Same Title Pages Section */}
      <StateDemo label="SameTitlePages (Pages with same title by other users)">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Users" size={16} />
              Same Title Pages Section
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/pages/SameTitlePages.tsx</code></p>
              <p>Shows other users who have written pages with the same title.</p>
              <h5 className="font-medium mt-3">Visibility Rules:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Loading:</strong> Returns null (no skeleton)</li>
                <li><strong>Error:</strong> Returns null (silent failure)</li>
                <li><strong>Owner + Empty:</strong> Returns null (hidden completely)</li>
                <li><strong>Non-owner + Empty:</strong> Shows &quot;No one else has written...&quot; message with &quot;Write your own&quot; button</li>
                <li><strong>Has pages:</strong> Shows UsernameBadge pills linking to each page</li>
              </ul>
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <code className="block">if (isOwner && pages.length === 0) return null;</code>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* What Links Here Section */}
      <StateDemo label="WhatLinksHere (Backlinks)">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="ArrowLeft" size={16} />
              What Links Here Section
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/pages/WhatLinksHere.tsx</code></p>
              <p>Shows pages that contain links to the current page (backlinks).</p>
              <h5 className="font-medium mt-3">Visibility Rules:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Loading:</strong> Shows skeleton placeholder</li>
                <li><strong>Error:</strong> Shows error message in card</li>
                <li><strong>No backlinks:</strong> Returns null (hidden completely)</li>
                <li><strong>Has backlinks:</strong> Shows collapsible list with PillLinks</li>
              </ul>
              <h5 className="font-medium mt-3">Interaction:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Collapsed by default with count in header</li>
                <li>Click to expand and show backlinks</li>
                <li>Limited to 20 backlinks for performance</li>
              </ul>
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <code className="block">if (backlinks.length === 0) return null;</code>
              </div>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Page Graph View */}
      <StateDemo label="PageGraphView">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Network" size={16} />
              Page Graph View
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/pages/PageGraphView.tsx</code></p>
              <p>Interactive network visualization showing page connections.</p>
              <h5 className="font-medium mt-3">Features:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Shows current page as central node</li>
                <li>Connected pages shown as linked nodes</li>
                <li>Reply relationships with type indicators (agree/disagree/neutral)</li>
                <li>Lazy-loaded for performance</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Related Pages Section */}
      <StateDemo label="RelatedPagesSection">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Link" size={16} />
              Related Pages Section
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/features/RelatedPagesSection.tsx</code></p>
              <p>Shows pages related by links or tags.</p>
              <h5 className="font-medium mt-3">Content:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Pages directly linked from content</li>
                <li>Pages by same author</li>
                <li>Lazy-loaded with skeleton placeholder</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Replies Section */}
      <StateDemo label="RepliesSection">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="MessageCircle" size={16} />
              Replies Section
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/features/RepliesSection.tsx</code></p>
              <p>Shows all pages that are replies to the current page.</p>
              <h5 className="font-medium mt-3">Features:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Filter by reply type (agree/disagree/all)</li>
                <li>Shows reply count per type</li>
                <li>Lazy-loaded for performance</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Location Section */}
      <StateDemo label="Location Field">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="MapPin" size={16} />
              Location Field
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/pages/LocationField.tsx</code></p>
              <p><code>app/components/map/LocationPickerPage.tsx</code></p>
              <p>Optional location attachment for pages.</p>
              <h5 className="font-medium mt-3">Behavior:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>No location + Owner:</strong> Shows &quot;Add location&quot; button</li>
                <li><strong>No location + Viewer:</strong> Hidden</li>
                <li><strong>Has location:</strong> Shows map preview, clickable to expand</li>
                <li>Full-screen picker at <code>/[id]/location</code></li>
                <li>Preserves zoom level on save</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Allocation Bar */}
      <StateDemo label="AllocationBar">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Heart" size={16} />
              Allocation Bar
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><code>app/components/payments/AllocationBar.tsx</code></p>
              <p>Sticky bottom bar for supporting page authors.</p>
              <h5 className="font-medium mt-3">Visibility:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Hidden on own pages (can&apos;t support yourself)</li>
                <li>Shows on other users&apos; pages</li>
                <li>Requires authentication to interact</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Section Order */}
      <StateDemo label="Section Render Order">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2">Render Order (top to bottom)</h4>
            <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
              <li>StickySaveHeader (fixed, when hasUnsavedChanges)</li>
              <li>ContentPageHeader (title, author, edit controls)</li>
              <li>DeletedPageBanner (conditional: isPreviewingDeleted)</li>
              <li>ContentDisplay (main content area)</li>
              <li>DenseModeToggle (view mode only)</li>
              <li>AutoSaveIndicator (when auto-save enabled)</li>
              <li>WritingIdeasBanner (new pages only, not replies)</li>
              <li>ContentPageFooter (actions, metadata fields)</li>
              <li>PageGraphView</li>
              <li>WhatLinksHere (hidden if no backlinks)</li>
              <li>Reply To card (conditional: page.replyTo exists)</li>
              <li>RepliesSection</li>
              <li>RelatedPagesSection</li>
              <li>Delete/Cancel button (owner only, at very bottom)</li>
              <li>AllocationBar (fixed bottom, non-owner pages)</li>
              <li>EmptyLinesAlert (fixed, when editing with empty lines)</li>
            </ol>
          </div>
        </div>
      </StateDemo>

      {/* New Page Mode */}
      <StateDemo label="New Page Mode">
        <div className="w-full space-y-4">
          <div className="wewrite-card">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Icon name="Plus" size={16} />
              New Page Mode
            </h4>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p>Triggered by navigating to <code>/[pageId]?new=true</code></p>
              <h5 className="font-medium mt-3">Behavior:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Page not created in database until first save</li>
                <li>Slide-up animation on entry</li>
                <li>Supports pre-filled title via <code>?title=</code> param</li>
                <li>Supports reply creation via <code>?replyTo=</code> params</li>
                <li>Cancel navigates back, no cleanup needed</li>
                <li>First save removes <code>?new=true</code> from URL</li>
              </ul>
              <h5 className="font-medium mt-3">Hidden Elements:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Page Graph View</li>
                <li>What Links Here</li>
                <li>Replies Section</li>
                <li>Related Pages Section</li>
                <li>Delete Button (shows Cancel instead)</li>
              </ul>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Key Design Principles */}
      <StateDemo label="Key Design Principles">
        <div className="w-full space-y-4">
          <div className="wewrite-card bg-primary/5 border-primary/20">
            <h4 className="font-semibold mb-2">Design Principles</h4>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><Icon name="Check" size={14} className="inline mr-2 text-green-500" />
                <strong>Hide empty sections</strong> - Don&apos;t show &quot;No results&quot; cards, just hide the section</li>
              <li><Icon name="Check" size={14} className="inline mr-2 text-green-500" />
                <strong>No skeleton loaders below fold</strong> - Lazy components render when ready, no flicker</li>
              <li><Icon name="Check" size={14} className="inline mr-2 text-green-500" />
                <strong>Lazy load heavy components</strong> - Graph, map, related pages loaded on demand</li>
              <li><Icon name="Check" size={14} className="inline mr-2 text-green-500" />
                <strong>Owner vs viewer differentiation</strong> - Show/hide controls based on ownership</li>
              <li><Icon name="Check" size={14} className="inline mr-2 text-green-500" />
                <strong>Focus new page mode</strong> - Hide distracting elements until first save</li>
              <li><Icon name="Check" size={14} className="inline mr-2 text-green-500" />
                <strong>Progressive disclosure</strong> - Collapse backlinks, expand on click</li>
            </ul>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
