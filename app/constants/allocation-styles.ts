/**
 * Allocation Bar Style Constants
 * 
 * Centralized styling constants for all allocation bar components to prevent
 * inconsistencies and ensure design system compliance.
 * 
 * IMPORTANT: Always use these constants instead of hardcoding classes.
 */

export const ALLOCATION_BAR_STYLES = {
  // Composition bar sections
  sections: {
    // Semi-transparent neutral that works on both solid backgrounds and colorful landing page
    other: 'bg-neutral-alpha-15 rounded-md transition-all duration-300 ease-out',
    current: 'bg-primary rounded-md transition-all duration-300 ease-out',
    overspent: 'bg-warn rounded-md transition-all duration-300 ease-out',
    available: 'bg-muted rounded-md transition-all duration-300 ease-out',
  },

  // Button styling
  buttons: {
    base: 'h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border-2 border-neutral-20',
    minus: 'h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border-2 border-neutral-20',
    plus: 'h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all duration-150 flex-shrink-0 border-2 border-neutral-20',
  },

  // Separator lines
  separators: {
    default: 'border-t border-neutral-20',
    withPadding: 'pt-3 border-t border-neutral-20 mt-3',
  },

  // Container styling
  containers: {
    compositionBar: 'flex-1 h-8 relative bg-muted rounded-lg',
    compositionBarTall: 'flex-1 h-12 flex gap-1 items-center bg-muted rounded-lg p-1',
  }
} as const;

/**
 * Usage Examples:
 * 
 * // Composition bar sections
 * <div className={ALLOCATION_BAR_STYLES.sections.other} />
 * <div className={ALLOCATION_BAR_STYLES.sections.current} />
 * 
 * // Buttons
 * <Button className={ALLOCATION_BAR_STYLES.buttons.minus}>
 *   <Minus className="h-4 w-4" />
 * </Button>
 * 
 * // Separators
 * <div className={ALLOCATION_BAR_STYLES.separators.withPadding}>
 *   Content here
 * </div>
 */

/**
 * Type-safe style accessor
 */
export type AllocationBarStyleKey = keyof typeof ALLOCATION_BAR_STYLES;
export type AllocationSectionKey = keyof typeof ALLOCATION_BAR_STYLES.sections;
export type AllocationButtonKey = keyof typeof ALLOCATION_BAR_STYLES.buttons;
export type AllocationSeparatorKey = keyof typeof ALLOCATION_BAR_STYLES.separators;
