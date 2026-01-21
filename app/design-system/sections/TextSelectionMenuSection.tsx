"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { ComponentShowcase, StateDemo, CollapsibleDocs } from './shared';

/**
 * Static mock of the text selection menu for design system display.
 * This is a simplified visual representation - not the functional component.
 */
function MockTextSelectionMenu({
  mode
}: {
  mode: 'view' | 'edit'
}) {
  const isEditMode = mode === 'edit';

  return (
    <div className="wewrite-card wewrite-floating wewrite-card-no-padding wewrite-card-rounded-lg overflow-hidden inline-block">
      <div className="flex gap-1 p-1">
        {/* Copy - only in view mode */}
        {!isEditMode && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
          >
            <Icon name="Copy" size={12} />
            Copy
          </Button>
        )}

        {/* Link - only in edit mode */}
        {isEditMode && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
          >
            <Icon name="Link" size={12} />
            Link
          </Button>
        )}

        {/* Share - only in view mode */}
        {!isEditMode && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
          >
            <Icon name="Share2" size={12} />
            Share
          </Button>
        )}

        {/* Add to Page - both modes */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-sm whitespace-nowrap flex-shrink-0"
        >
          <Icon name="Quote" size={12} />
          Add to
        </Button>
      </div>
    </div>
  );
}

export function TextSelectionMenuSection({ id }: { id: string }) {
  const [selectedMode, setSelectedMode] = useState<'view' | 'edit'>('view');

  return (
    <ComponentShowcase
      id={id}
      title="Text Selection Menu"
      path="app/components/text-selection/UnifiedTextSelectionMenu.tsx"
      description="Floating menu that appears when text is selected. Shows different actions based on view vs edit mode. Uses glassmorphic card styling with horizontal scroll for narrow viewports."
    >
      <StateDemo label="View Mode (Reading)">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When viewing content you don't own, the menu shows Copy, Share, and Add to Page options.
          </p>
          <div className="flex justify-center py-4 bg-muted/30 rounded-lg">
            <MockTextSelectionMenu mode="view" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="Copy" size={12} />
              <span><strong>Copy</strong> - Copies selected text to clipboard</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Share2" size={12} />
              <span><strong>Share</strong> - Creates a shareable link to the selection</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Quote" size={12} />
              <span><strong>Add to</strong> - Adds quoted text to one of your pages</span>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Edit Mode (Editing)">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When editing your own content, the menu shows Link and Add to Page options. Copy and Share are hidden since the focus is on editing.
          </p>
          <div className="flex justify-center py-4 bg-muted/30 rounded-lg">
            <MockTextSelectionMenu mode="edit" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="Link" size={12} />
              <span><strong>Link</strong> - Opens insert link modal to turn selection into a link</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Quote" size={12} />
              <span><strong>Add to</strong> - Adds quoted text to another page</span>
            </div>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Side by Side Comparison">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-center">View Mode</p>
            <div className="flex justify-center py-4 bg-muted/30 rounded-lg">
              <MockTextSelectionMenu mode="view" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-center">Edit Mode</p>
            <div className="flex justify-center py-4 bg-muted/30 rounded-lg">
              <MockTextSelectionMenu mode="edit" />
            </div>
          </div>
        </div>
      </StateDemo>

      <CollapsibleDocs type="props">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Key Props</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-muted px-1 rounded">canEdit</code> - When true, shows edit-mode menu (Link instead of Copy/Share)</li>
              <li><code className="bg-muted px-1 rounded">enableCopy</code> - Enable/disable Copy button (view mode only)</li>
              <li><code className="bg-muted px-1 rounded">enableShare</code> - Enable/disable Share button (view mode only)</li>
              <li><code className="bg-muted px-1 rounded">enableAddToPage</code> - Enable/disable Add to Page button (both modes)</li>
              <li><code className="bg-muted px-1 rounded">selectedText</code> - The currently selected text</li>
              <li><code className="bg-muted px-1 rounded">position</code> - Screen coordinates for menu placement</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Button Actions</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Copy:</strong> Copies text to clipboard with attribution metadata</li>
              <li><strong>Share:</strong> Creates a shareable URL with text highlight anchor</li>
              <li><strong>Link:</strong> Opens LinkEditorModal to search and link to pages/users</li>
              <li><strong>Add to:</strong> Opens modal to append quoted text to existing or new page</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Positioning</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Menu appears above the selection, centered horizontally</li>
              <li>Clamped to viewport edges with 12px padding</li>
              <li>Horizontal scrolling with chevron indicators for overflow</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Styling</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Uses <code className="bg-muted px-1 rounded">wewrite-card wewrite-floating</code> for glassmorphic effect</li>
              <li>Ghost variant buttons with icon + text labels</li>
              <li>Fixed position, rendered via portal to document.body for modals</li>
            </ul>
          </div>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
