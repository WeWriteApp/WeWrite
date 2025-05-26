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
  rightContent?: React.ReactNode; // Legacy prop for backward compatibility
}

/**
 * Standardized SectionTitle component for use across the application
 *
 * This is the unified section title component that replaces all other variants.
 * It supports both the new `children` prop and legacy `rightContent` prop for
 * backward compatibility during the migration.
 *
 * @param icon - Optional Lucide icon component
 * @param title - The section title text
 * @param description - Optional description text
 * @param className - Optional additional class names for the container
 * @param iconClassName - Optional additional class names for the icon
 * @param titleClassName - Optional additional class names for the title
 * @param descriptionClassName - Optional additional class names for the description
 * @param children - Optional children to render in the right side of the header
 * @param rightContent - Legacy prop for backward compatibility (use children instead)
 */
export function SectionTitle({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
  titleClassName,
  descriptionClassName,
  children,
  rightContent
}: SectionTitleProps) {
  // Use children if provided, otherwise fall back to rightContent for backward compatibility
  const rightSideContent = children || rightContent;

  return (
    <div className={cn("flex items-center justify-between gap-2 sm:gap-4 pt-2 mb-2", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <Icon className={cn("h-5 w-5 text-muted-foreground flex-shrink-0", iconClassName)} />
        )}
        <div className="flex flex-col min-w-0">
          <h2 className={cn("text-lg font-semibold leading-tight", titleClassName)}>
            {title}
          </h2>
          {description && (
            <p className={cn("text-sm text-muted-foreground", descriptionClassName)}>
              {description}
            </p>
          )}
        </div>
      </div>
      {rightSideContent && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {rightSideContent}
        </div>
      )}
    </div>
  );
}

// Default export for backward compatibility
export default SectionTitle;
