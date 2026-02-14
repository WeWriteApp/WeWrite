'use client';

import { useState, useEffect } from 'react';

/**
 * Detects whether the user has a physical keyboard.
 *
 * - Non-touch devices → always true (assumed desktop/laptop)
 * - Touch devices → false by default, flips to true if a physical keyboard
 *   input is detected (Tab, arrow keys, Escape, or modifier combos like Ctrl+K)
 *
 * Once a keyboard is detected, it stays detected for the session.
 * Use this to conditionally hide keyboard shortcut tips on mobile.
 */

// Session-level flag so all hook instances share the detection
let detectedKeyboard = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Keys that strongly indicate a physical keyboard (virtual keyboards don't expose these) */
const PHYSICAL_KEYBOARD_KEYS = new Set([
  'Tab', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

function handleKeyDown(e: KeyboardEvent) {
  if (detectedKeyboard) return;

  // Modifier combo (Ctrl+key or Cmd+key) or a physical-only key
  if (e.ctrlKey || e.metaKey || e.altKey || PHYSICAL_KEYBOARD_KEYS.has(e.key)) {
    detectedKeyboard = true;
    notifyListeners();
    document.removeEventListener('keydown', handleKeyDown);
  }
}

export function useHasKeyboard(): boolean {
  const [hasKeyboard, setHasKeyboard] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR: assume keyboard
    if (detectedKeyboard) return true;
    return !isTouchDevice();
  });

  useEffect(() => {
    // Non-touch device — always has keyboard
    if (!isTouchDevice()) {
      setHasKeyboard(true);
      return;
    }

    // Already detected from a previous interaction
    if (detectedKeyboard) {
      setHasKeyboard(true);
      return;
    }

    // Listen for detection changes from the shared listener
    const onChange = () => setHasKeyboard(true);
    listeners.add(onChange);

    // Start listening for keyboard events (only once globally)
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return hasKeyboard;
}
