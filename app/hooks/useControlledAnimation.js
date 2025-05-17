"use client";

import { useState, useEffect, useRef } from 'react';
import { useRenderControl, useIsNavigating } from '../providers/RenderControlProvider';

/**
 * useControlledAnimation
 *
 * A custom hook that controls animations to ensure they only run once
 * per component instance, even if the component re-renders multiple times.
 *
 * Enhanced to handle page transitions smoothly by:
 * 1. Tracking navigation state
 * 2. Preventing animations during navigation
 * 3. Ensuring consistent animation behavior across page loads
 *
 * @param {string} componentId - A unique identifier for the component
 * @param {boolean} [disabled=false] - Whether to disable the animation control
 * @param {boolean} [animateOnNavigation=false] - Whether to animate when navigating between pages
 * @returns {boolean} - Whether the animation should run
 */
export function useControlledAnimation(componentId, disabled = false, animateOnNavigation = false) {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const { isFirstRender, registerComponent } = useRenderControl();
  const { isNavigating, lastNavigationTime } = useIsNavigating();

  // Track component mount time to compare with navigation time
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    // If animation control is disabled, always animate
    if (disabled) {
      setShouldAnimate(true);
      return;
    }

    // Check if this component was mounted after the last navigation
    const mountedAfterNavigation = mountTimeRef.current > lastNavigationTime;

    // Determine if we should animate based on navigation state
    if (animateOnNavigation) {
      // If we want to animate during navigation, check if this is a new navigation
      if (isNavigating || mountedAfterNavigation) {
        registerComponent(componentId);
        setShouldAnimate(true);
      } else if (isFirstRender(componentId)) {
        // If it's the first render but not during navigation
        registerComponent(componentId);
        setShouldAnimate(true);
      } else {
        // Don't animate on subsequent renders
        setShouldAnimate(false);
      }
    } else {
      // Standard behavior - only animate on first render
      if (isFirstRender(componentId)) {
        registerComponent(componentId);
        setShouldAnimate(true);
      } else {
        setShouldAnimate(false);
      }
    }
  }, [
    componentId,
    disabled,
    isFirstRender,
    registerComponent,
    isNavigating,
    lastNavigationTime,
    animateOnNavigation
  ]);

  return shouldAnimate;
}

export default useControlledAnimation;
