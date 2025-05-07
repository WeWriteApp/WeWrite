"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionTitleProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  rightContent?: React.ReactNode;
}

/**
 * Standardized section title component for use across the application
 *
 * @param {LucideIcon} icon - The Lucide icon to display next to the title
 * @param {string} title - The section title text
 * @param {string} description - Optional description text to display below the title
 * @param {React.ReactNode} rightContent - Optional content to display on the right side of the header
 */
export default function SectionTitle({
  icon: Icon,
  title,
  description,
  rightContent
}: SectionTitleProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {rightContent && (
        <div className="flex items-center">
          {rightContent}
        </div>
      )}
    </div>
  );
}
