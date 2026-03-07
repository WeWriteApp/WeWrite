'use client';

import React, { useState } from 'react';
import { CommandGroup, CommandItem } from '../ui/command';
import { Icon } from '@/components/ui/Icon';

interface CollapsibleCommandGroupProps {
  heading: string;
  initialCount: number;
  children: React.ReactNode;
}

/**
 * A CommandGroup that truncates its children and shows a "View N more" toggle.
 * Wraps cmdk's CommandGroup with collapse/expand behavior.
 */
export default function CollapsibleCommandGroup({
  heading,
  initialCount,
  children,
}: CollapsibleCommandGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const childArray = React.Children.toArray(children);
  const totalCount = childArray.length;
  const needsTruncation = totalCount > initialCount;
  const visibleChildren = expanded || !needsTruncation
    ? childArray
    : childArray.slice(0, initialCount);
  const hiddenCount = totalCount - initialCount;

  return (
    <CommandGroup heading={heading}>
      {visibleChildren}
      {needsTruncation && (
        <CommandItem
          value={`__toggle-${heading}`}
          onSelect={() => setExpanded((prev) => !prev)}
          className="justify-center text-muted-foreground"
        >
          <Icon
            name={expanded ? 'ChevronUp' : 'ChevronDown'}
            size={14}
            className="mr-1.5 shrink-0"
          />
          <span className="text-xs">
            {expanded ? `Show fewer` : `View ${hiddenCount} more ${heading.toLowerCase()} items`}
          </span>
        </CommandItem>
      )}
    </CommandGroup>
  );
}
