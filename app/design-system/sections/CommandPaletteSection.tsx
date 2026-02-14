'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '../../components/ui/command';
import { Button } from '../../components/ui/button';
import { ComponentShowcase, StateDemo } from './shared';

function DemoCommandPalette({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--card-bg)] shadow-lg overflow-hidden max-w-lg w-full">
      <Command>
        {children}
      </Command>
    </div>
  );
}

export function CommandPaletteSection({ id }: { id: string }) {
  const [search, setSearch] = useState('');

  return (
    <ComponentShowcase
      id={id}
      title="Command Palette"
      path="app/components/command-palette/CommandPalette.tsx"
      description="Keyboard-driven command palette for navigation, settings, and page actions. Triggered by /, Cmd+K, or Cmd+Shift+P."
    >
      <StateDemo label="Default (Navigation + Actions)">
        <DemoCommandPalette>
          <CommandInput placeholder="Type a command or search..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              <CommandItem value="nav home">
                <Icon name="Home" size={16} className="mr-2 shrink-0" />
                <span>Go to Home</span>
              </CommandItem>
              <CommandItem value="nav search">
                <Icon name="Search" size={16} className="mr-2 shrink-0" />
                <span>Go to Search</span>
              </CommandItem>
              <CommandItem value="nav leaderboard">
                <Icon name="Trophy" size={16} className="mr-2 shrink-0" />
                <span>Go to Leaderboards</span>
              </CommandItem>
              <CommandItem value="nav notifications">
                <Icon name="Bell" size={16} className="mr-2 shrink-0" />
                <span>Go to Notifications</span>
              </CommandItem>
              <CommandItem value="nav profile">
                <Icon name="User" size={16} className="mr-2 shrink-0" />
                <span>Go to Profile</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem value="create new page">
                <Icon name="Plus" size={16} className="mr-2 shrink-0" />
                <span>Create New Page</span>
              </CommandItem>
              <CommandItem value="go to random page">
                <Icon name="Shuffle" size={16} className="mr-2 shrink-0" />
                <span>Go to Random Page</span>
              </CommandItem>
              <CommandItem value="search find">
                <Icon name="Search" size={16} className="mr-2 shrink-0" />
                <span>Search</span>
                <CommandShortcut>/</CommandShortcut>
              </CommandItem>
              <CommandItem value="log out">
                <Icon name="LogOut" size={16} className="mr-2 shrink-0" />
                <span>Log Out</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </DemoCommandPalette>
      </StateDemo>

      <StateDemo label="Settings Group">
        <DemoCommandPalette>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Settings">
              <CommandItem value="fund account">
                <Icon name="Wallet" size={16} className="mr-2 shrink-0" />
                <span>Fund Account</span>
              </CommandItem>
              <CommandItem value="profile">
                <Icon name="User" size={16} className="mr-2 shrink-0" />
                <span>Profile</span>
              </CommandItem>
              <CommandItem value="appearance">
                <Icon name="Palette" size={16} className="mr-2 shrink-0" />
                <span>Appearance</span>
              </CommandItem>
              <CommandItem value="notifications">
                <Icon name="Bell" size={16} className="mr-2 shrink-0" />
                <span>Notifications</span>
              </CommandItem>
              <CommandItem value="security">
                <Icon name="Shield" size={16} className="mr-2 shrink-0" />
                <span>Security</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </DemoCommandPalette>
      </StateDemo>

      <StateDemo label="Page Actions (viewing a page)">
        <DemoCommandPalette>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Page: My First Post">
              <CommandItem value="edit page">
                <Icon name="Pencil" size={16} className="mr-2 shrink-0" />
                <span>Edit Page</span>
              </CommandItem>
              <CommandItem value="copy link">
                <Icon name="Link" size={16} className="mr-2 shrink-0" />
                <span>Copy Link</span>
              </CommandItem>
              <CommandItem value="toggle paragraph mode">
                <Icon name="FileText" size={16} className="mr-2 shrink-0" />
                <span>Toggle Paragraph Mode</span>
              </CommandItem>
              <CommandItem value="delete page">
                <Icon name="Trash2" size={16} className="mr-2 shrink-0" />
                <span>Delete Page</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </DemoCommandPalette>
      </StateDemo>

      <StateDemo label="Editor Actions (editing a page)">
        <DemoCommandPalette>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Editor">
              <CommandItem value="insert link">
                <Icon name="Link" size={16} className="mr-2 shrink-0" />
                <span>Insert Link</span>
                <CommandShortcut>Cmd+K</CommandShortcut>
              </CommandItem>
              <CommandItem value="add location">
                <Icon name="MapPin" size={16} className="mr-2 shrink-0" />
                <span>Add Location</span>
              </CommandItem>
              <CommandItem value="save">
                <Icon name="Check" size={16} className="mr-2 shrink-0" />
                <span>Save</span>
                <CommandShortcut>Cmd+S</CommandShortcut>
              </CommandItem>
              <CommandItem value="cancel">
                <Icon name="X" size={16} className="mr-2 shrink-0" />
                <span>Cancel Editing</span>
                <CommandShortcut>Esc</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </DemoCommandPalette>
      </StateDemo>

      <StateDemo label="Empty State">
        <DemoCommandPalette>
          <CommandInput placeholder="Type a command or search..." value="xyznonexistent" onValueChange={() => {}} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              <CommandItem value="nav home">
                <Icon name="Home" size={16} className="mr-2 shrink-0" />
                <span>Go to Home</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </DemoCommandPalette>
      </StateDemo>

      <StateDemo label="Keyboard Shortcuts">
        <div className="text-sm space-y-1 text-muted-foreground">
          <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">/</kbd> — Open palette (when not in an input)</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Cmd+K</kbd> — Open palette (when not editing a page)</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Cmd+Shift+P</kbd> — Open palette (always works)</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Esc</kbd> — Close palette</div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
