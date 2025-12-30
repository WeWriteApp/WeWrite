"use client";

import React from 'react';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Standard animation presets for stack items
 * Use these for consistent enter/exit animations across the app
 */
export const stackItemVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  visible: {
    opacity: 1,
    height: 'auto',
    marginTop: 'var(--stack-gap, 0px)',
    marginBottom: 0,
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
  },
};

/**
 * Animation presets with different feels
 */
export const ANIMATION_PRESETS = {
  /** Standard smooth animation - good for most UI elements */
  default: {
    duration: 0.2,
    ease: 'easeOut' as const,
  },
  /** Faster animation - good for quick feedback */
  fast: {
    duration: 0.15,
    ease: 'easeOut' as const,
  },
  /** Slower animation - good for emphasis */
  slow: {
    duration: 0.3,
    ease: 'easeInOut' as const,
  },
  /** Spring animation - bouncy, playful feel */
  spring: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 30,
  },
  /** Gentle spring - subtle bounce */
  gentleSpring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
  },
} as const;

export type AnimationPreset = keyof typeof ANIMATION_PRESETS;

interface AnimatedStackProps {
  /** The items to render in the stack */
  children: React.ReactNode;
  /** Gap between items in pixels */
  gap?: number;
  /** Animation preset to use */
  preset?: AnimationPreset;
  /** Additional className for the container */
  className?: string;
  /** Direction of the stack */
  direction?: 'vertical' | 'horizontal';
}

/**
 * AnimatedStack - A container that animates children in and out
 *
 * Wrap your conditional items in AnimatedStackItem components.
 * Items will smoothly animate in/out with height transitions to prevent layout shifts.
 *
 * @example
 * ```tsx
 * <AnimatedStack gap={12}>
 *   {items.map(item => (
 *     <AnimatedStackItem key={item.id}>
 *       <Card>{item.content}</Card>
 *     </AnimatedStackItem>
 *   ))}
 *   {showButton && (
 *     <AnimatedStackItem key="button">
 *       <Button>Click me</Button>
 *     </AnimatedStackItem>
 *   )}
 * </AnimatedStack>
 * ```
 */
export function AnimatedStack({
  children,
  gap = 0,
  preset = 'default',
  className,
  direction = 'vertical',
}: AnimatedStackProps) {
  return (
    <div
      className={cn(
        direction === 'vertical' ? 'flex flex-col' : 'flex flex-row',
        className
      )}
      style={{
        '--stack-gap': `${gap}px`,
      } as React.CSSProperties}
    >
      <AnimatePresence mode="sync">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return null;

          // If child is already an AnimatedStackItem, pass the preset
          if (child.type === AnimatedStackItem) {
            return React.cloneElement(child as React.ReactElement<AnimatedStackItemProps>, {
              preset: child.props.preset || preset,
            });
          }

          // Otherwise wrap it
          return (
            <AnimatedStackItem key={child.key} preset={preset}>
              {child}
            </AnimatedStackItem>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

interface AnimatedStackItemProps {
  /** The content to animate */
  children: React.ReactNode;
  /** Animation preset to use (inherited from parent if not specified) */
  preset?: AnimationPreset;
  /** Additional className */
  className?: string;
  /** Custom layout ID for shared element transitions */
  layoutId?: string;
}

/**
 * AnimatedStackItem - Individual item in an AnimatedStack
 *
 * Can be used inside AnimatedStack or standalone with AnimatePresence.
 * Animates height from 0 to auto for smooth layout transitions.
 */
export function AnimatedStackItem({
  children,
  preset = 'default',
  className,
  layoutId,
}: AnimatedStackItemProps) {
  const transition = ANIMATION_PRESETS[preset];

  return (
    <motion.div
      layout={!!layoutId}
      layoutId={layoutId}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={stackItemVariants}
      transition={transition}
      className={cn('overflow-hidden', className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Standalone wrapper for single elements that need enter/exit animation
 * Use when you don't need a full stack, just one conditional element
 *
 * @example
 * ```tsx
 * <AnimatedPresenceItem show={showError} gap={12}>
 *   <ErrorBanner message="Something went wrong" />
 * </AnimatedPresenceItem>
 * ```
 */
interface AnimatedPresenceItemProps {
  /** Whether to show the item */
  show: boolean;
  /** The content to animate */
  children: React.ReactNode;
  /** Gap/margin when visible (in pixels) */
  gap?: number;
  /** Animation preset */
  preset?: AnimationPreset;
  /** Position of the gap */
  gapPosition?: 'top' | 'bottom' | 'both';
  /** Additional className */
  className?: string;
}

export function AnimatedPresenceItem({
  show,
  children,
  gap = 0,
  preset = 'default',
  gapPosition = 'top',
  className,
}: AnimatedPresenceItemProps) {
  const transition = ANIMATION_PRESETS[preset];

  const variants: Variants = {
    hidden: {
      opacity: 0,
      height: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    visible: {
      opacity: 1,
      height: 'auto',
      marginTop: gapPosition === 'top' || gapPosition === 'both' ? gap : 0,
      marginBottom: gapPosition === 'bottom' || gapPosition === 'both' ? gap : 0,
    },
    exit: {
      opacity: 0,
      height: 0,
      marginTop: 0,
      marginBottom: 0,
    },
  };

  return (
    <AnimatePresence mode="sync">
      {show && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants}
          transition={transition}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AnimatedStack;
