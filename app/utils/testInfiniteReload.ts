"use client";

/**
 * Test utility for simulating infinite reload scenarios
 * This is for development and testing purposes only
 */

import { infiniteReloadDetector } from './infiniteReloadDetector';

export function simulateInfiniteReload() {
  if (typeof window === 'undefined') return;

  console.log('[TestInfiniteReload] Simulating infinite reload scenario...');

  // Simulate multiple rapid reloads
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      infiniteReloadDetector.recordManualReload(`Test reload ${i + 1}`);
      console.log(`[TestInfiniteReload] Simulated reload ${i + 1}/4`);
    }, i * 100);
  }

  console.log('[TestInfiniteReload] Simulation complete. Circuit breaker should trigger.');
}

// Add to window for easy testing in browser console
if (typeof window !== 'undefined') {
  (window as any).simulateInfiniteReload = simulateInfiniteReload;
  (window as any).infiniteReloadDetector = infiniteReloadDetector;
}

export default simulateInfiniteReload;
