"use client";

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatOptions?: Intl.NumberFormatOptions;
  className?: string;
}

/**
 * AnimatedNumber - A rolling counter component that smoothly animates
 * between number values with an easing effect.
 *
 * Used for stats cards, counters, and any numeric display that needs
 * to animate when the value changes.
 */
export default function AnimatedNumber({
  value,
  duration = 500,
  formatOptions,
  className = ''
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip animation on initial mount
    if (previousValue.current === value) {
      return;
    }

    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    // Easing function for smooth animation
    const easeOutQuart = (t: number): number => {
      return 1 - Math.pow(1 - t, 4);
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  // Update previous value when value changes
  useEffect(() => {
    previousValue.current = value;
  }, [value]);

  const formattedValue = formatOptions
    ? new Intl.NumberFormat('en-US', formatOptions).format(displayValue)
    : displayValue.toLocaleString();

  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
}

/**
 * AnimatedDiff - Shows animated +/- diff numbers with color coding
 */
export function AnimatedDiff({
  added,
  removed,
  duration = 400,
  className = ''
}: {
  added: number;
  removed: number;
  duration?: number;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      {added > 0 && (
        <span className="text-green-600 dark:text-green-400">
          +<AnimatedNumber value={added} duration={duration} />
        </span>
      )}
      {removed > 0 && (
        <span className="text-red-600 dark:text-red-400">
          -<AnimatedNumber value={removed} duration={duration} />
        </span>
      )}
    </span>
  );
}
