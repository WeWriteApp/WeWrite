"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '../../lib/utils';

interface RollingDigitProps {
  digit: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down';
}

/**
 * Single rolling digit that animates like a slot machine reel
 */
function RollingDigit({ digit, delay = 0, duration = 500, direction = 'up' }: RollingDigitProps) {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [prevDigit, setPrevDigit] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animDirection, setAnimDirection] = useState<'up' | 'down'>('up');
  const [activeDuration, setActiveDuration] = useState(duration);
  const prevDigitRef = useRef(digit);
  const containerRef = useRef<HTMLSpanElement>(null);
  const lastChangeTimeRef = useRef<number>(0);

  useEffect(() => {
    if (digit !== prevDigitRef.current) {
      const now = Date.now();
      const timeSinceLastChange = now - lastChangeTimeRef.current;
      lastChangeTimeRef.current = now;

      // Calculate adaptive duration based on how fast changes are coming
      // If changes are rapid (< duration), speed up the animation
      // duration is the lower bound (slowest) for single events
      let adaptiveDuration = duration;
      if (timeSinceLastChange < duration && timeSinceLastChange > 0) {
        // Scale duration based on input frequency, with a minimum of 50ms
        adaptiveDuration = Math.max(50, Math.min(timeSinceLastChange * 0.8, duration));
      }

      // Store the previous digit for animation
      setPrevDigit(prevDigitRef.current);
      setIsAnimating(false);
      setAnimDirection(direction);
      setActiveDuration(adaptiveDuration);
      prevDigitRef.current = digit;

      // Trigger animation on next frame (after initial render at position 0)
      const animationFrame = requestAnimationFrame(() => {
        // Double RAF to ensure the browser has painted the initial state
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });

      // Listen for transition end to clean up
      const container = containerRef.current;
      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'transform') {
          setCurrentDigit(digit);
          setPrevDigit(null);
          setIsAnimating(false);
        }
      };

      if (container) {
        container.addEventListener('transitionend', handleTransitionEnd);
      }

      // Fallback cleanup in case transitionend doesn't fire
      const fallbackTimer = setTimeout(() => {
        setCurrentDigit(digit);
        setPrevDigit(null);
        setIsAnimating(false);
      }, delay + adaptiveDuration + 100);

      return () => {
        cancelAnimationFrame(animationFrame);
        clearTimeout(fallbackTimer);
        if (container) {
          container.removeEventListener('transitionend', handleTransitionEnd);
        }
      };
    }
  }, [digit, delay, duration, direction]);

  // When we have a previous digit, show both stacked for animation
  if (prevDigit !== null) {
    const isGoingUp = animDirection === 'up';

    // For going up: [prev][new] starts at 0, animates to -1em (new slides into view from below)
    // For going down: [new][prev] starts at -1em (new is above viewport), animates to 0 (new slides into view from above)

    return (
      <span className="relative inline-flex overflow-hidden h-[1em] w-[0.6em] justify-center">
        <span
          ref={containerRef}
          className="inline-flex flex-col items-center"
          style={{
            transform: isGoingUp
              ? (isAnimating ? 'translateY(-1em)' : 'translateY(0)')
              : (isAnimating ? 'translateY(0)' : 'translateY(-1em)'),
            transition: isAnimating ? `transform ${activeDuration}ms ease-out ${delay}ms` : 'none',
          }}
        >
          {isGoingUp ? (
            <>
              {/* Going up: prev visible at start, new below - slide up to reveal new */}
              <span className="h-[1em] flex items-center justify-center">
                {prevDigit}
              </span>
              <span className="h-[1em] flex items-center justify-center">
                {digit}
              </span>
            </>
          ) : (
            <>
              {/* Going down: new above (hidden), prev visible - slide down to reveal new */}
              <span className="h-[1em] flex items-center justify-center">
                {digit}
              </span>
              <span className="h-[1em] flex items-center justify-center">
                {prevDigit}
              </span>
            </>
          )}
        </span>
      </span>
    );
  }

  // Static display (not animating)
  return (
    <span className="relative inline-flex overflow-hidden h-[1em] w-[0.6em] justify-center">
      <span className="inline-flex flex-col items-center">
        <span className="h-[1em] flex items-center justify-center">
          {currentDigit}
        </span>
      </span>
    </span>
  );
}

interface RollingCounterProps {
  value: number;
  className?: string;
  /** Animation duration per digit in ms */
  duration?: number;
  /** Stagger delay between digits in ms */
  staggerDelay?: number;
  /** Format the number with commas */
  formatWithCommas?: boolean;
  /** Prefix to display before the number (e.g., "$") */
  prefix?: string;
  /** Suffix to display after the number (e.g., "views") */
  suffix?: string;
  /** Decimal places to show */
  decimals?: number;
}

/**
 * RollingCounter - Animated counter with slot machine style rolling digits
 *
 * @example
 * ```tsx
 * <RollingCounter value={1234} />
 * <RollingCounter value={99.99} prefix="$" decimals={2} />
 * <RollingCounter value={1000000} formatWithCommas suffix=" views" />
 * ```
 */
export function RollingCounter({
  value,
  className,
  duration = 400,
  staggerDelay = 50,
  formatWithCommas = true,
  prefix = '',
  suffix = '',
  decimals = 0,
}: RollingCounterProps) {
  // Track previous value to determine direction
  const prevValueRef = useRef(value);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  // Update direction when value changes
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setDirection(value > prevValueRef.current ? 'up' : 'down');
      prevValueRef.current = value;
    }
  }, [value]);

  // Format the value
  const formattedValue = useMemo(() => {
    let numStr = decimals > 0
      ? value.toFixed(decimals)
      : Math.floor(value).toString();

    if (formatWithCommas) {
      const parts = numStr.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      numStr = parts.join('.');
    }

    return numStr;
  }, [value, formatWithCommas, decimals]);

  // Split into characters (digits, commas, decimals)
  const characters = formattedValue.split('');

  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)}>
      {prefix && <span>{prefix}</span>}
      {characters.map((char, index) => {
        // Non-digit characters (comma, decimal) don't animate
        if (!/\d/.test(char)) {
          return (
            <span key={`sep-${index}`} className="w-[0.3em]">
              {char}
            </span>
          );
        }

        // Calculate delay - rightmost digits animate first (like a real counter)
        const digitIndex = characters.length - 1 - index;
        const delay = digitIndex * staggerDelay;

        return (
          <RollingDigit
            key={`digit-${index}`}
            digit={char}
            delay={delay}
            duration={duration}
            direction={direction}
          />
        );
      })}
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

export default RollingCounter;
