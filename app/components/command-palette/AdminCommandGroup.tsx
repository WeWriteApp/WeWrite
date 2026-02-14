'use client';

import React from 'react';
import { CommandGroup, CommandItem } from '../ui/command';
import { AdminDataProvider } from '../../providers/AdminDataProvider';
import { useAdminSections } from '../../hooks/useAdminSections';

interface AdminCommandGroupProps {
  onSelectSection: (sectionId: string) => void;
}

function AdminCommandGroupInner({ onSelectSection }: AdminCommandGroupProps) {
  const { sections } = useAdminSections();

  return (
    <CommandGroup heading="Admin">
      {sections.map((section) => (
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
