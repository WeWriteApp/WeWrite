import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  children?: React.ReactNode;
}

/**
 * SectionTitle component
 * 
 * A standardized section title component with an optional icon and description
 * 
 * @param icon - Optional Lucide icon component
 * @param title - The section title text
 * @param description - Optional description text
 * @param className - Optional additional class names for the container
 * @param iconClassName - Optional additional class names for the icon
 * @param titleClassName - Optional additional class names for the title
 * @param descriptionClassName - Optional additional class names for the description
 * @param children - Optional children to render in the right side of the header
 */
export function SectionTitle({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
  titleClassName,
  descriptionClassName,
  children
}: SectionTitleProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4", className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon className={cn("h-5 w-5 text-muted-foreground", iconClassName)} />
        )}
        <div className="flex flex-col">
          <h2 className={cn("text-lg font-semibold", titleClassName)}>
            {title}
          </h2>
          {description && (
            <p className={cn("text-sm text-muted-foreground", descriptionClassName)}>
              {description}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center">
          {children}
        </div>
      )}
    </div>
  );
}
