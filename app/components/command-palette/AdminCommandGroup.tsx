'use client';

import React from 'react';
import { CommandGroup, CommandItem } from '../ui/command';
import { AdminDataProvider } from '../../providers/AdminDataProvider';
import { useAdminSections } from '../../hooks/useAdminSections';

interface AdminCommandGroupProps {
  onSelectSection: (sectionId: string) => void;
  inputValue?: string;
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true;
  return value.toLowerCase().includes(query.toLowerCase());
}

function AdminCommandGroupInner({ onSelectSection, inputValue = '' }: AdminCommandGroupProps) {
  const { sections } = useAdminSections();

  const filtered = inputValue
    ? sections.filter((section) =>
        matchesQuery(`admin ${section.title} ${section.description ?? ''}`, inputValue)
      )
    : sections;

  if (filtered.length === 0) return null;

  return (
    <CommandGroup heading="Admin">
      {filtered.map((section) => (
        <CommandItem
          key={section.id}
          value={`admin ${section.title} ${section.description ?? ''}`}
          onSelect={() => onSelectSection(section.id)}
        >
          <section.icon className="mr-2 shrink-0" />
          <span>{section.title}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/**
 * Wraps the admin command group with AdminDataProvider since the command palette
 * renders outside the admin layout tree.
 */
export default function AdminCommandGroup(props: AdminCommandGroupProps) {
  return (
    <AdminDataProvider>
      <AdminCommandGroupInner {...props} />
    </AdminDataProvider>
  );
}
