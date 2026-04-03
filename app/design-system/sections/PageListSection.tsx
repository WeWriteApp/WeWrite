"use client";

import React, { useState } from 'react';
import { UnifiedPageList, PageListViewToggle } from '../../components/pages/UnifiedPageList';
import type { PageItem, PageListView } from '../../components/pages/UnifiedPageList';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

const SAMPLE_PAGES: PageItem[] = [
  { id: 'p1', title: 'Getting Started with WeWrite', isPublic: true, userId: 'u1', username: 'alice', lastModified: '2026-03-28T12:00:00Z' },
  { id: 'p2', title: 'Advanced Collaboration Tips', isPublic: true, userId: 'u2', username: 'bob', lastModified: '2026-03-25T08:30:00Z' },
  { id: 'p3', title: 'My Private Notes', isPublic: false, userId: 'u1', username: 'alice', lastModified: '2026-03-20T14:00:00Z' },
  { id: 'p4', title: 'Design System Documentation', isPublic: true, userId: 'u3', username: 'carol', lastModified: '2026-03-15T10:00:00Z' },
  { id: 'p5', title: 'Project Roadmap 2026', isPublic: true, userId: 'u1', username: 'alice', lastModified: '2026-03-10T16:45:00Z' },
  { id: 'p6', title: 'Meeting Notes — March', isPublic: false, userId: 'u2', username: 'bob', lastModified: '2026-03-05T09:00:00Z' },
];

function InteractiveDemo() {
  const [view, setView] = useState<PageListView>('wrapped');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {SAMPLE_PAGES.length} pages
        </div>
        <PageListViewToggle view={view} onViewChange={setView} />
      </div>
      <UnifiedPageList
        pages={SAMPLE_PAGES}
        view={view}
        onViewChange={setView}
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
        <p className="text-xs text-muted-foreground mb-2">Vertical list with author and date metadata.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="list" />
      </StateDemo>

      <StateDemo label="Compact View">
        <p className="text-xs text-muted-foreground mb-2">Dense vertical PillLinks — one per line.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="compact" />
      </StateDemo>

      <StateDemo label="Empty State">
        <UnifiedPageList pages={[]} />
      </StateDemo>

      <StateDemo label="Owned Pages (private visible)">
        <p className="text-xs text-muted-foreground mb-2">When isOwned=true, private page titles are visible instead of hidden.</p>
        <UnifiedPageList pages={SAMPLE_PAGES} view="wrapped" isOwned={true} />
      </StateDemo>

      <CollapsibleDocs title="Usage & API">
        <DocsCodeBlock>
          {`import { UnifiedPageList, PageListViewToggle } from '@/components/pages/UnifiedPageList';
import type { PageItem, PageListView } from '@/components/pages/UnifiedPageList';

// Basic usage — wrapped PillLinks (default)
<UnifiedPageList pages={pages} />

// With view toggle (controlled)
const [view, setView] = useState<PageListView>('wrapped');
<PageListViewToggle view={view} onViewChange={setView} />
<UnifiedPageList pages={pages} view={view} onViewChange={setView} />

// With built-in view toggle
<UnifiedPageList pages={pages} showViewToggle />

// Show owned pages (private titles visible)
<UnifiedPageList pages={pages} isOwned={true} />

// Custom empty state
<UnifiedPageList pages={[]} emptyState={<MyEmptyState />} />

// List view with item actions
<UnifiedPageList
  pages={pages}
  view="list"
  renderItemAction={(page) => <Button size="sm">Edit</Button>}
/>`}
        </DocsCodeBlock>
        <div className="mt-4 space-y-2 text-sm">
          <p><strong>Views:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><code className="text-foreground">wrapped</code> — PillLink pills in a flex-wrap layout (default)</li>
            <li><code className="text-foreground">list</code> — Vertical rows with title, author, and date</li>
            <li><code className="text-foreground">compact</code> — Dense vertical PillLinks, one per line</li>
          </ul>
          <p className="mt-3"><strong>Used in:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>User profile pages tab</li>
            <li>Group pages tab</li>
          </ul>
          <p className="mt-3"><strong>PageItem shape:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><code className="text-foreground">id</code>, <code className="text-foreground">title</code> (required)</li>
            <li><code className="text-foreground">isPublic</code>, <code className="text-foreground">userId</code>, <code className="text-foreground">username</code>, <code className="text-foreground">lastModified</code>, <code className="text-foreground">createdAt</code> (optional)</li>
          </ul>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
