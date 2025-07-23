"use client";

import { useState, useRef, useCallback } from 'react';

interface UseTokenParticleEffectReturn {
  triggerEffect: boolean;
  originElement: HTMLElement | null;
  triggerParticleEffect: (element: HTMLElement) => void;
  resetEffect: () => void;
}

/**
 * Hook to manage token particle effect state and triggering
 * 
 * This hook provides a clean interface for triggering particle effects
 * from specific DOM elements, ensuring proper cleanup and state management.
 */
export function useTokenParticleEffect(): UseTokenParticleEffectReturn {
  const [triggerEffect, setTriggerEffect] = useState(false);
  const [originElement, setOriginElement] = useState<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const triggerParticleEffect = useCallback((element: HTMLElement) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set the origin element and trigger the effect
    setOriginElement(element);
    setTriggerEffect(true);

    // Reset the trigger after a short delay to allow for re-triggering
    timeoutRef.current = setTimeout(() => {
      setTriggerEffect(false);
    }, 100);
  }, []);

  const resetEffect = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setTriggerEffect(false);
    setOriginElement(null);
  }, []);

  return {
    triggerEffect,
    originElement,
    triggerParticleEffect,
    resetEffect
  };
}
