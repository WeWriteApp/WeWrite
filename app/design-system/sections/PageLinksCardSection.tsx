"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageLinksCard, PageLinkItem } from '@/components/ui/PageLinksCard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AnimatedPresenceItem, AnimatedHorizontalPresence } from '@/components/ui/AnimatedStack';
import { ComponentShowcase, StateDemo, CollapsibleDocs, DocsCodeBlock } from './shared';

/**
 * PageLinksCard Design System Documentation
 *
 * Documents the PageLinksCard component used for displaying lists of page links
 * with optional filtering, custom rendering, and header actions.
 */
export function PageLinksCardSection({ id }: { id: string }) {
  // Sample data for demos
  const sampleItems: PageLinkItem[] = [
    { id: 'page-1', title: 'Getting Started Guide' },
    { id: 'page-2', title: 'API Reference' },
    { id: 'page-3', title: 'Best Practices' },
    { id: 'page-4', title: 'Troubleshooting' },
    { id: 'page-5', title: 'FAQ' },
  ];

  const manyItems: PageLinkItem[] = [
    { id: 'page-1', title: 'Introduction' },
    { id: 'page-2', title: 'Setup' },
    { id: 'page-3', title: 'Configuration' },
    { id: 'page-4', title: 'Usage' },
    { id: 'page-5', title: 'Advanced Topics' },
    { id: 'page-6', title: 'Best Practices' },
    { id: 'page-7', title: 'Migration Guide' },
    { id: 'page-8', title: 'Performance Tips' },
    { id: 'page-9', title: 'Security Notes' },
    { id: 'page-10', title: 'Troubleshooting' },
    { id: 'page-11', title: 'FAQ' },
    { id: 'page-12', title: 'Changelog' },
  ];

  // Filter state for interactive demo
  const [showFiltersRow, setShowFiltersRow] = useState(false);
  const [showAuthor, setShowAuthor] = useState(true);

  // Filter button for interactive demo
  const filterButton = (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={() => setShowFiltersRow(!showFiltersRow)}
      aria-label="Toggle filters"
    >
      <Icon name="SlidersHorizontal" size={16} className={showFiltersRow ? "text-primary" : "text-muted-foreground"} />
    </Button>
  );

  // Filter row content
  const filterRow = (
    <AnimatedPresenceItem show={showFiltersRow} gap={12} preset="fast">
      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Label htmlFor="show-author-demo" className="text-sm text-muted-foreground">
            Show author
          </Label>
        </div>
        <Switch
          id="show-author-demo"
          checked={showAuthor}
          onCheckedChange={setShowAuthor}
        />
      </div>
    </AnimatedPresenceItem>
  );

  return (
    <ComponentShowcase
      id={id}
      title="Page Links Card"
      path="app/components/ui/PageLinksCard.tsx"
      description="Unified card component for displaying lists of page links with filtering, load more, and custom rendering"
    >
      {/* Basic Usage */}
      <StateDemo label="Basic Usage">
        <div className="w-full max-w-md">
          <PageLinksCard
            icon="Link2"
            title="What links here"
            items={sampleItems}
          />
        </div>
      </StateDemo>

      {/* With Pill Counter */}
      <StateDemo label="Pill Counter Style">
        <div className="w-full max-w-md">
          <PageLinksCard
            icon="Link2"
            title="What links here"
            items={sampleItems}
            pillCounter={true}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Use <code>pillCounter=&#123;true&#125;</code> to show count as a pill badge on the right (matches StatsCard pattern).
          </p>
        </div>
      </StateDemo>

      {/* With Filter (headerAction) */}
      <StateDemo label="With Filter Button (headerAction)">
        <div className="w-full max-w-md">
          <PageLinksCard
            icon="Link2"
            title="What links here"
            items={sampleItems}
            pillCounter={true}
            headerAction={filterButton}
            subheader={filterRow}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Use <code>headerAction</code> for filter/action buttons. Use <code>subheader</code> for expandable filter controls.
          </p>
        </div>
      </StateDemo>

      {/* Load More */}
      <StateDemo label="With Load More">
        <div className="w-full max-w-md">
          <PageLinksCard
            icon="FileText"
            title="Related pages"
            items={manyItems}
            initialLimit={5}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Set <code>initialLimit</code> to show fewer items with a "Load more" button.
          </p>
        </div>
      </StateDemo>

      {/* Loading State */}
      <StateDemo label="Loading State">
        <div className="w-full max-w-md">
          <PageLinksCard
            icon="Link2"
            title="What links here"
            items={[]}
            loading={true}
          />
        </div>
      </StateDemo>

      {/* Empty State */}
      <StateDemo label="Empty State">
        <div className="w-full max-w-md">
          <PageLinksCard
            icon="Link2"
            title="What links here"
            items={[]}
            hideWhenEmpty={false}
            emptyMessage="No pages link here yet"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Set <code>hideWhenEmpty=&#123;false&#125;</code> and <code>emptyMessage</code> to show empty state.
          </p>
        </div>
      </StateDemo>

      {/* Props Reference */}
      <CollapsibleDocs type="props">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold">Prop</th>
                <th className="text-left py-2 px-3 font-semibold">Type</th>
                <th className="text-left py-2 px-3 font-semibold">Default</th>
                <th className="text-left py-2 px-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>icon</code></td>
                <td className="py-2 px-3">IconName</td>
                <td className="py-2 px-3">required</td>
                <td className="py-2 px-3">Icon to display in header</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>title</code></td>
                <td className="py-2 px-3">string</td>
                <td className="py-2 px-3">required</td>
                <td className="py-2 px-3">Title text for the header</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>items</code></td>
                <td className="py-2 px-3">PageLinkItem[]</td>
                <td className="py-2 px-3">required</td>
                <td className="py-2 px-3">Array of page link items</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>pillCounter</code></td>
                <td className="py-2 px-3">boolean</td>
                <td className="py-2 px-3">false</td>
                <td className="py-2 px-3">Show count as pill badge on right</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>headerAction</code></td>
                <td className="py-2 px-3">ReactNode</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Action button(s) in header right</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>subheader</code></td>
                <td className="py-2 px-3">ReactNode</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Content between header and items (filter controls)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>initialLimit</code></td>
                <td className="py-2 px-3">number</td>
                <td className="py-2 px-3">8</td>
                <td className="py-2 px-3">Items to show before "Load more"</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>hideWhenEmpty</code></td>
                <td className="py-2 px-3">boolean</td>
                <td className="py-2 px-3">true</td>
                <td className="py-2 px-3">Hide card when no items</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>emptyMessage</code></td>
                <td className="py-2 px-3">string</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Message to show when empty</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>renderItem</code></td>
                <td className="py-2 px-3">function</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Custom item renderer</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3"><code>footer</code></td>
                <td className="py-2 px-3">ReactNode</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3">Footer content with separator</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleDocs>

      {/* Filter Pattern */}
      <CollapsibleDocs type="usage" title="Filter Button Pattern">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Standard filter button implementation:</p>
          <DocsCodeBlock>
{`const [showFiltersRow, setShowFiltersRow] = useState(false);

const filterButton = (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 w-7 p-0"
    onClick={() => setShowFiltersRow(!showFiltersRow)}
  >
    <Icon
      name="SlidersHorizontal"
      size={16}
      className={showFiltersRow ? "text-primary" : "text-muted-foreground"}
    />
  </Button>
);

<PageLinksCard
  headerAction={filterButton}
  subheader={<FilterRow show={showFiltersRow} />}
  ...
/>`}
          </DocsCodeBlock>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
