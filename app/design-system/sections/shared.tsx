"use client";

import React, { useState } from 'react';
import { Icon, IconName } from '@/components/ui/Icon';

export interface SectionProps {
  id: string;
}

export interface ComponentShowcaseProps {
  id: string;
  title: string;
  path: string;
  description: string;
  children: React.ReactNode;
}

export function ComponentShowcase({ id, title, path, description, children }: ComponentShowcaseProps) {
  return (
    <div id={id} className="wewrite-card space-y-4 scroll-mt-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{path}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

export function StateDemo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <div className="flex flex-wrap gap-2 items-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Predefined documentation section types with consistent styling
 */
export type DocsSectionType = 'usage' | 'props' | 'guidelines' | 'api' | 'notes' | 'custom';

interface DocsSectionConfig {
  icon: IconName;
  defaultTitle: string;
  borderColor: string;
}

const DOCS_SECTION_CONFIG: Record<DocsSectionType, DocsSectionConfig> = {
  usage: {
    icon: 'Code',
    defaultTitle: 'Usage',
    borderColor: 'border-l-blue-500',
  },
  props: {
    icon: 'Settings',
    defaultTitle: 'Props',
    borderColor: 'border-l-purple-500',
  },
  guidelines: {
    icon: 'BookOpen',
    defaultTitle: 'Guidelines',
    borderColor: 'border-l-amber-500',
  },
  api: {
    icon: 'Terminal',
    defaultTitle: 'API Reference',
    borderColor: 'border-l-green-500',
  },
  notes: {
    icon: 'Info',
    defaultTitle: 'Notes',
    borderColor: 'border-l-cyan-500',
  },
  custom: {
    icon: 'FileText',
    defaultTitle: 'Documentation',
    borderColor: 'border-l-border',
  },
};

export interface CollapsibleDocsProps {
  /** The type of documentation section - determines icon and default title */
  type?: DocsSectionType;
  /** Custom title (overrides default from type) */
  title?: string;
  /** Custom icon (overrides default from type) */
  icon?: IconName;
  /** Whether the section is expanded by default */
  defaultExpanded?: boolean;
  /** Content to show in the collapsible section */
  children: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * CollapsibleDocs - A collapsible documentation section for the design system
 *
 * Use this to wrap documentation content (Usage, Props, Guidelines, API) to keep
 * the focus on interactive component demos while making docs easily accessible.
 */
export function CollapsibleDocs({
  type = 'custom',
  title,
  icon,
  defaultExpanded = false,
  children,
  className = '',
}: CollapsibleDocsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = DOCS_SECTION_CONFIG[type];

  const displayTitle = title || config.defaultTitle;
  const displayIcon = icon || config.icon;

  return (
    <div className={`rounded-lg border border-border overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 p-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors border-l-4 ${config.borderColor}`}
      >
        <Icon
          name={displayIcon}
          size={16}
          className="text-muted-foreground shrink-0"
        />
        <span className="text-sm font-medium flex-1">{displayTitle}</span>
        <Icon
          name="ChevronDown"
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ease-in-out ${
          isExpanded
            ? 'max-h-[2000px] opacity-100'
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="p-4 space-y-4 border-t border-border">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * DocsCodeBlock - Styled code block for documentation
 */
export interface DocsCodeBlockProps {
  /** Optional label above the code block */
  label?: string;
  /** The code content */
  children: string;
  /** Language hint (for future syntax highlighting) */
  language?: 'typescript' | 'tsx' | 'bash';
}

export function DocsCodeBlock({ label, children, language = 'typescript' }: DocsCodeBlockProps) {
  return (
    <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

/**
 * DocsNote - Styled note/callout for documentation
 */
export interface DocsNoteProps {
  /** Variant determines color and icon */
  variant?: 'info' | 'warning' | 'tip' | 'important';
  /** Optional title */
  title?: string;
  /** Content */
  children: React.ReactNode;
}

const NOTE_CONFIG: Record<string, { icon: IconName; borderColor: string; titleColor: string }> = {
  info: { icon: 'Info', borderColor: 'border-l-blue-500', titleColor: 'text-blue-700 dark:text-blue-400' },
  warning: { icon: 'AlertTriangle', borderColor: 'border-l-amber-500', titleColor: 'text-amber-700 dark:text-amber-400' },
  tip: { icon: 'Lightbulb', borderColor: 'border-l-green-500', titleColor: 'text-green-700 dark:text-green-400' },
  important: { icon: 'AlertCircle', borderColor: 'border-l-red-500', titleColor: 'text-red-700 dark:text-red-400' },
};

export function DocsNote({ variant = 'info', title, children }: DocsNoteProps) {
  const config = NOTE_CONFIG[variant];

  return (
    <div className={`wewrite-card p-4 border-l-4 ${config.borderColor} bg-muted/20`}>
      {title && (
        <div className={`flex items-center gap-2 mb-2 ${config.titleColor}`}>
          <Icon name={config.icon} size={16} />
          <h4 className="font-semibold">{title}</h4>
        </div>
      )}
      <div className="text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
