"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../../components/ui/dropdown-menu';
import { ComponentShowcase, StateDemo } from './shared';

export function MenuDropdownSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Menu (Dropdown)"
      path="app/components/ui/dropdown-menu.tsx"
      description="Contextual menus with glassmorphic styling, staggered animations, and scale feedback on hover/press. Uses portal rendering for proper z-index handling."
    >
      <StateDemo label="Basic Dropdown">
        <div className="flex gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Icon name="MoreHorizontal" size={16} className="mr-2" />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Icon name="Edit" size={16} className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Icon name="Copy" size={16} className="mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Icon name="Share" size={16} className="mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Icon name="Trash2" size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </StateDemo>

      <StateDemo label="Open Direction">
        <div className="flex flex-wrap gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">Bottom-Left</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent openDirection="bottom-left">
              <DropdownMenuItem>Option 1</DropdownMenuItem>
              <DropdownMenuItem>Option 2</DropdownMenuItem>
              <DropdownMenuItem>Option 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">Bottom-Right (Default)</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent openDirection="bottom-right">
              <DropdownMenuItem>Option 1</DropdownMenuItem>
              <DropdownMenuItem>Option 2</DropdownMenuItem>
              <DropdownMenuItem>Option 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">Top-Left</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent openDirection="top-left">
              <DropdownMenuItem>Option 1</DropdownMenuItem>
              <DropdownMenuItem>Option 2</DropdownMenuItem>
              <DropdownMenuItem>Option 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">Top-Right</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent openDirection="top-right">
              <DropdownMenuItem>Option 1</DropdownMenuItem>
              <DropdownMenuItem>Option 2</DropdownMenuItem>
              <DropdownMenuItem>Option 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </StateDemo>

      <StateDemo label="User Account Menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Icon name="User" size={16} className="text-primary" />
              </div>
              Account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Icon name="User" size={16} className="mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="Settings" size={16} className="mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="Download" size={16} className="mr-2" />
              Downloads
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Icon name="LogOut" size={16} className="mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </StateDemo>

      <StateDemo label="Icon-Only Trigger">
        <div className="flex gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Icon name="MoreHorizontal" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Icon name="ExternalLink" size={16} className="mr-2" />
                Open in new tab
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Icon name="Copy" size={16} className="mr-2" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Icon name="Share" size={16} className="mr-2" />
                Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </StateDemo>

      <StateDemo label="Animation & Interaction Details">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">Open Direction API</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li><code className="bg-muted px-1 rounded">openDirection="bottom-left"</code> - Opens down, anchored to trigger's left edge</li>
            <li><code className="bg-muted px-1 rounded">openDirection="bottom-right"</code> - Opens down, anchored to trigger's right edge (default)</li>
            <li><code className="bg-muted px-1 rounded">openDirection="top-left"</code> - Opens up, anchored to trigger's left edge</li>
            <li><code className="bg-muted px-1 rounded">openDirection="top-right"</code> - Opens up, anchored to trigger's right edge</li>
          </ul>

          <h4 className="font-medium mb-2">Menu Animations</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li>Content: <code className="bg-muted px-1 rounded">opacity</code> with <code className="bg-muted px-1 rounded">translateY</code> (pure vertical slide)</li>
            <li>Bottom-*: Slides down from -8px above</li>
            <li>Top-*: Slides up from 8px below</li>
            <li>Items: Staggered fade-in with 30ms delay between each</li>
            <li>Duration: 150ms ease-out</li>
          </ul>

          <h4 className="font-medium mb-2">Item Hover States</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li>Hover: <code className="bg-muted px-1 rounded">bg-accent text-accent-foreground scale-[1.02]</code></li>
            <li>Active: <code className="bg-muted px-1 rounded">scale-[0.98]</code> with 75ms transition</li>
          </ul>

          <h4 className="font-medium mb-2">Styling</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Uses <code className="bg-muted px-1 rounded">wewrite-card wewrite-floating</code> for glassmorphic backdrop</li>
            <li>Portal rendered to <code className="bg-muted px-1 rounded">document.body</code> for proper z-index</li>
            <li>Position: Fixed, measured with useLayoutEffect for accurate alignment</li>
          </ul>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
