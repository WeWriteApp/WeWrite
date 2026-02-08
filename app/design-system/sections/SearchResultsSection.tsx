"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PillLink } from '../../components/utils/PillLink';
import { UsernameBadge } from '../../components/ui/UsernameBadge';
import { ComponentShowcase, StateDemo, CollapsibleDocs } from './shared';
import { cn } from '../../lib/utils';

// Mock data for demonstrations
const mockUsers = [
  { id: 'user1', username: 'alexsmith' },
  { id: 'user2', username: 'testuser' },
  { id: 'user3', username: 'username_change_test' },
  { id: 'user4', username: 'jamie' },
];

const mockPages = [
  { id: 'page1', title: 'Getting Started Guide', username: 'alexsmith', userId: 'user1' },
  { id: 'page2', title: 'API Documentation', username: 'testuser', userId: 'user2' },
  { id: 'page3', title: 'Best Practices', username: 'jamie', userId: 'user4' },
  { id: 'page4', title: 'Troubleshooting Tips', username: 'alexsmith', userId: 'user1' },
];

// Reusable search result row component for demos
function SearchResultRow({
  type,
  children,
  isSelected = false,
  showAuthor,
  authorUsername,
  authorUserId,
}: {
  type: 'user' | 'page';
  children: React.ReactNode;
  isSelected?: boolean;
  showAuthor?: boolean;
  authorUsername?: string;
  authorUserId?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-md transition-colors",
        isSelected && "bg-black/5 dark:bg-white/5 outline outline-1 outline-black/10 dark:outline-white/10"
      )}
    >
      <div className="min-w-0 flex-1 max-w-[calc(100%-80px)]">
        {children}
      </div>
      {type === 'user' && (
        <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
          User
        </span>
      )}
      {type === 'page' && showAuthor && authorUsername && authorUserId && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
          <span>by</span>
          <UsernameBadge
            userId={authorUserId}
            username={authorUsername}
            size="sm"
            variant="link"
            className="text-xs"
          />
        </div>
      )}
    </div>
  );
}

export function SearchResultsSection({ id }: { id: string }) {
  const [demoSelectedIndex, setDemoSelectedIndex] = useState(2);

  return (
    <ComponentShowcase
      id={id}
      title="Search Results"
      path="app/components/search/SearchResultsDisplay.tsx"
      description="Search result list items with keyboard navigation support. Users can press ↑↓ to navigate and Enter to open."
    >
      {/* Keyboard Navigation Demo */}
      <StateDemo label="Keyboard Selection States">
        <div className="w-full space-y-4">
          <p className="text-sm text-muted-foreground mb-2">
            Click the buttons below to simulate keyboard navigation, or use the actual ↑↓ keys while focused.
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setDemoSelectedIndex(prev => prev > 0 ? prev - 1 : mockUsers.length + mockPages.length - 1)}
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md flex items-center gap-1"
            >
              <Icon name="ArrowUp" size={14} /> Previous
            </button>
            <button
              onClick={() => setDemoSelectedIndex(prev => prev < mockUsers.length + mockPages.length - 1 ? prev + 1 : 0)}
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md flex items-center gap-1"
            >
              <Icon name="ArrowDown" size={14} /> Next
            </button>
            <button
              onClick={() => setDemoSelectedIndex(-1)}
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md"
            >
              Clear Selection
            </button>
          </div>

          <div className="wewrite-card p-4 space-y-4">
            {/* Users section */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold mb-2">Users</h3>
              {mockUsers.map((user, index) => (
                <SearchResultRow
                  key={user.id}
                  type="user"
                  isSelected={demoSelectedIndex === index}
                >
                  <PillLink href={`/user/${user.id}`} clickable={false}>
                    {user.username}
                  </PillLink>
                </SearchResultRow>
              ))}
            </div>

            {/* Pages section */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold mb-2">Pages</h3>
              {mockPages.map((page, index) => (
                <SearchResultRow
                  key={page.id}
                  type="page"
                  isSelected={demoSelectedIndex === mockUsers.length + index}
                  showAuthor
                  authorUsername={page.username}
                  authorUserId={page.userId}
                >
                  <PillLink href={`/${page.id}`} clickable={false}>
                    {page.title}
                  </PillLink>
                </SearchResultRow>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Currently selected: {demoSelectedIndex === -1 ? 'None' : `Index ${demoSelectedIndex}`}
          </p>
        </div>
      </StateDemo>

      {/* Selection Style Comparison */}
      <StateDemo label="Selection State Styling">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Unselected (default)</p>
            <div className="wewrite-card p-3">
              <SearchResultRow type="page" isSelected={false} showAuthor authorUsername="jamie" authorUserId="user4">
                <PillLink href="/example" clickable={false}>Example Page</PillLink>
              </SearchResultRow>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected (keyboard focus)</p>
            <div className="wewrite-card p-3">
              <SearchResultRow type="page" isSelected={true} showAuthor authorUsername="jamie" authorUserId="user4">
                <PillLink href="/example" clickable={false}>Example Page</PillLink>
              </SearchResultRow>
            </div>
          </div>
        </div>
      </StateDemo>

      {/* Loading State */}
      <StateDemo label="Loading State">
        <div className="w-full wewrite-card p-4">
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Icon name="Loader" size={32} />
            <p className="text-sm text-muted-foreground">Searching for "example"...</p>
          </div>
        </div>
      </StateDemo>

      {/* Empty State */}
      <StateDemo label="No Results State">
        <div className="w-full wewrite-card p-4 text-center py-4">
          <p className="text-muted-foreground">No results found for "xyz123"</p>
        </div>
      </StateDemo>

      {/* Keyboard Hint */}
      <StateDemo label="Keyboard Navigation Hint">
        <div className="w-full">
          <p className="text-xs text-muted-foreground/60">
            Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↓</kbd> to navigate, <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to open
          </p>
        </div>
      </StateDemo>

      <CollapsibleDocs type="notes">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Keyboard Navigation</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↓</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↑</kbd> - Navigate through results (wraps around)</li>
              <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> - Open selected result</li>
              <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Escape</kbd> - Clear selection</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Selection Styling</h4>
            <p className="text-sm text-muted-foreground">
              Selected items use <code className="bg-muted px-1 rounded">bg-black/5 dark:bg-white/5</code> with a subtle
              <code className="bg-muted px-1 rounded ml-1">outline-black/10 dark:outline-white/10</code> border.
              Using Tailwind's built-in black/white with opacity ensures reliable rendering across all themes.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Result Order</h4>
            <p className="text-sm text-muted-foreground">
              Results are displayed in sections: Users first, then Pages. Keyboard navigation follows this order from top to bottom.
            </p>
          </div>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
