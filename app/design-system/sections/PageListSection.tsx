"use client";

import React, { useState, useMemo } from 'react';
import { UnifiedPageList, PageListViewToggle, ListMetadataSelector } from '../../components/pages/UnifiedPageList';
import type { PageItem, PageListView, ListMetadata } from '../../components/pages/UnifiedPageList';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/Icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

const SAMPLE_PAGES: PageItem[] = [
  { id: 'p1', title: 'Getting Started with WeWrite', isPublic: true, userId: 'u1', username: 'alice', lastModified: '2026-03-28T12:00:00Z', createdAt: '2026-03-01T10:00:00Z', earnings: 1250 },
  { id: 'p2', title: 'Advanced Collaboration Tips', isPublic: true, userId: 'u2', username: 'bob', lastModified: '2026-03-25T08:30:00Z', createdAt: '2026-02-15T09:00:00Z', earnings: 890 },
  { id: 'p3', title: 'My Private Notes', isPublic: false, userId: 'u1', username: 'alice', lastModified: '2026-03-20T14:00:00Z', createdAt: '2026-02-01T12:00:00Z', earnings: 0 },
  { id: 'p4', title: 'Design System Documentation', isPublic: true, userId: 'u3', username: 'carol', lastModified: '2026-03-15T10:00:00Z', createdAt: '2026-01-20T08:00:00Z', earnings: 3400 },
  { id: 'p5', title: 'Project Roadmap 2026', isPublic: true, userId: 'u1', username: 'alice', lastModified: '2026-03-10T16:45:00Z', createdAt: '2026-01-05T14:00:00Z', earnings: 560 },
  { id: 'p6', title: 'Meeting Notes — March', isPublic: false, userId: 'u2', username: 'bob', lastModified: '2026-03-05T09:00:00Z', createdAt: '2025-12-10T11:00:00Z', earnings: 120 },
];

type SortField = 'title' | 'date' | 'earnings' | 'author';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'date', label: 'Date' },
  { value: 'earnings', label: 'Earnings' },
];

function sortPages(pages: PageItem[], field: SortField, direction: SortDirection): PageItem[] {
  return [...pages].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'title':
        cmp = (a.title || '').localeCompare(b.title || '');
        break;
      case 'author':
        cmp = (a.username || '').localeCompare(b.username || '');
        break;
      case 'date': {
        const da = new Date(a.createdAt || a.lastModified || 0).getTime();
        const db = new Date(b.createdAt || b.lastModified || 0).getTime();
        cmp = da - db;
        break;
      }
      case 'earnings':
        cmp = (a.earnings || 0) - (b.earnings || 0);
        break;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
}

function getSortFieldLabel(field: SortField): string {
  return SORT_OPTIONS.find(option => option.value === field)?.label || 'Sort';
}

function InteractiveDemo() {
  const [view, setView] = useState<PageListView>('wrapped');
  const [listMetadata, setListMetadata] = useState<ListMetadata>('none');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedPages = useMemo(
    () => sortPages(SAMPLE_PAGES, sortField, sortDirection),
    [sortField, sortDirection]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {SAMPLE_PAGES.length} pages
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8 gap-2">
                  {getSortFieldLabel(sortField)}
                  <Icon name="ChevronDown" size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSortField(opt.value)}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span>{opt.label}</span>
                    {sortField === opt.value && <Icon name="Check" size={14} />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
              className="h-8 w-8 p-0"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              <Icon name={sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={14} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view === 'list' && (
            <ListMetadataSelector metadata={listMetadata} onMetadataChange={setListMetadata} />
          )}
          <PageListViewToggle view={view} onViewChange={setView} />
        </div>
      </div>
      <UnifiedPageList
        pages={sortedPages}
        view={view}
        onViewChange={setView}
        listMetadata={listMetadata}
        onListMetadataChange={setListMetadata}
      />
    </div>
  );
}

export function PageListSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Page List"
      path="app/components/pages/UnifiedPageList.tsx"
      description="Shared page list component used across profiles, groups, and anywhere pages need to be displayed. Supports multiple view modes with a persistent toggle."
    >
      <StateDemo label="Interactive — Toggle Views">
        <InteractiveDemo />
      </StateDemo>

      <StateDemo label="Wrapped View (default)">
        <p className="text-xs text-muted-foreground mb-2">PillLink pills in a wrapped flex layout — the standard page list style.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="wrapped" />
      </StateDemo>

      <StateDemo label="List View">
        <p className="text-xs text-muted-foreground mb-2">One pill per line. Supports metadata display via the dropdown selector.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="list" />
      </StateDemo>

      <StateDemo label="List View — with Author">
        <p className="text-xs text-muted-foreground mb-2">List view showing author byline on each pill.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="list" listMetadata="author" />
      </StateDemo>

      <StateDemo label="List View — with Date">
        <p className="text-xs text-muted-foreground mb-2">List view showing created date on each pill.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="list" listMetadata="created" />
      </StateDemo>

      <StateDemo label="List View — with Earnings">
        <p className="text-xs text-muted-foreground mb-2">List view showing page earnings on each pill.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="list" listMetadata="earnings" />
      </StateDemo>

      <StateDemo label="List View — with Custom Value">
        <p className="text-xs text-muted-foreground mb-2">List view with a custom right-aligned value for sortable metrics.</p>
        <UnifiedPageList
          pages={SAMPLE_PAGES}
          view="list"
          renderItemValue={(page) => `${Math.round((page.earnings || 0) / 100)} pts`}
        />
      </StateDemo>

      <StateDemo label="Empty State">
        <UnifiedPageList pages={[]} />
      </StateDemo>

      <StateDemo label="Custom Empty State">
        <UnifiedPageList pages={[]} emptyIcon="PenLine" emptyTitle="No writing yet" emptyDescription="Start writing your first page!" />
      </StateDemo>

      <StateDemo label="Owned Pages (private visible)">
        <p className="text-xs text-muted-foreground mb-2">When isOwned=true, private page titles are visible instead of hidden.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="wrapped" isOwned={true} />
      </StateDemo>

      <CollapsibleDocs title="Usage & API">
        <DocsCodeBlock>
          {`import { UnifiedPageList, PageListViewToggle, ListMetadataSelector } from '@/components/pages/UnifiedPageList';
import type { PageItem, PageListView, ListMetadata } from '@/components/pages/UnifiedPageList';

// Basic usage — wrapped PillLinks (default)
<UnifiedPageList pages={pages} />

// With view toggle (controlled)
const [view, setView] = useState<PageListView>('wrapped');
const [metadata, setMetadata] = useState<ListMetadata>('none');
<PageListViewToggle view={view} onViewChange={setView} />
{view === 'list' && <ListMetadataSelector metadata={metadata} onMetadataChange={setMetadata} />}
<UnifiedPageList pages={pages} view={view} onViewChange={setView} listMetadata={metadata} onListMetadataChange={setMetadata} />

// With built-in view toggle
<UnifiedPageList pages={pages} showViewToggle />

// Show owned pages (private titles visible)
<UnifiedPageList pages={pages} isOwned={true} />

// Custom empty state props
<UnifiedPageList pages={[]} emptyIcon="PenLine" emptyTitle="No writing yet" emptyDescription="Create your first page!" />

// List view with specific metadata
<UnifiedPageList pages={pages} view="list" listMetadata="author" />

// List view with item actions
<UnifiedPageList
  pages={pages}
  view="list"
  renderItemAction={(page) => <Button size="sm">Edit</Button>}
/>

// List view with a sortable key/value metric on the right
<UnifiedPageList
  pages={pages}
  view="list"
  renderItemValue={(page) => page.linkCount}
/>`}
        </DocsCodeBlock>
        <div className="mt-4 space-y-2 text-sm">
          <p><strong>Views:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><code className="text-foreground">wrapped</code> — PillLink pills in a flex-wrap layout (default)</li>
            <li><code className="text-foreground">list</code> — One PillLink per line with optional metadata byline</li>
          </ul>
          <p className="mt-3"><strong>List Metadata options:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><code className="text-foreground">none</code> — No byline (default)</li>
            <li><code className="text-foreground">author</code> — Show author username</li>
            <li><code className="text-foreground">last-edited</code> — Show last edited date</li>
            <li><code className="text-foreground">created</code> — Show created date</li>
            <li><code className="text-foreground">earnings</code> — Show page earnings</li>
            <li><code className="text-foreground">views</code>, <code className="text-foreground">views-24h</code>, <code className="text-foreground">sponsors</code>, <code className="text-foreground">links</code>, <code className="text-foreground">backlinks</code>, <code className="text-foreground">replies</code> — Show KPI values when present</li>
          </ul>
          <p className="mt-3"><strong>Custom list values:</strong></p>
          <p className="text-muted-foreground">
            Use <code className="text-foreground">renderItemValue</code> to show a right-aligned value for sortable metrics like last edited time, link count, views, or other KPIs.
          </p>
          <p className="mt-3"><strong>Used in:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>User profile pages tab</li>
            <li>Group pages tab</li>
          </ul>
          <p className="mt-3"><strong>PageItem shape:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><code className="text-foreground">id</code>, <code className="text-foreground">title</code> (required)</li>
            <li><code className="text-foreground">isPublic</code>, <code className="text-foreground">userId</code>, <code className="text-foreground">username</code>, <code className="text-foreground">lastModified</code>, <code className="text-foreground">createdAt</code>, <code className="text-foreground">earnings</code> (optional)</li>
          </ul>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
