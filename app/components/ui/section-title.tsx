import React from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  icon?: IconName;
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
 * WeWrite Section Header Padding Improvements - SectionTitle Component
 *
 * Standardized SectionTitle component for use across the application with
 * optimized padding for improved visual hierarchy and content relationships.
 *
 * This is the unified section title component that replaces all other variants.
 * It supports both the new `children` prop and legacy `rightContent` prop for
 * backward compatibility during the migration.
 *
 * Padding Improvements Implemented:
 * - Added top padding (pt-2): Creates better separation from content above
 * - Reduced bottom margin (mb-4 → mb-2): Brings headers closer to their content below
 * - Coordinated with StickySection wrapper padding for optimal visual balance
 *
 * Visual Impact:
 * Before: Large gaps both above and below section headers
 * After: Increased separation from preceding content, reduced gap to section content
 *
 * Affected Section Headers:
 * - Recent Activity: Better visual separation and content proximity
 * - Your Groups: Improved spacing around "New Group" button
 * - Trending Pages: Enhanced visual hierarchy
 * - Random Pages: Better spacing around shuffle and privacy controls
 * - Top Users: Consistent spacing with other sections
 *
 * Technical Benefits:
 * - Improved Visual Hierarchy: Better separation from preceding content
 * - Enhanced Content Relationship: Headers closer to their associated content
 * - Consistent Spacing: Uniform padding across all section headers
 * - Maintained Functionality: All existing features preserved
 * - Responsive Behavior: Padding adjustments work across all screen sizes
 * - Sticky Compatibility: Optimized for both normal and sticky states
 *
 * @param icon - Optional icon name
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
  icon: iconName,
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
        {iconName && (
          <Icon name={iconName} size={20} className={cn("text-muted-foreground flex-shrink-0", iconClassName)} />
        )}
        <div className="flex flex-col min-w-0">
          <h2 className={cn("text-lg font-semibold leading-tight hyphens-none", titleClassName)}>
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