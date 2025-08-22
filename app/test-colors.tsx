'use client';

import React from 'react';
import { AllocationBarBase } from './components/payments/AllocationBarBase';

export default function TestColors() {
  React.useEffect(() => {
    // Debug CSS variables
    const root = document.documentElement;
    const warningVar = getComputedStyle(root).getPropertyValue('--warning');
    const warningBaseVar = getComputedStyle(root).getPropertyValue('--warning-base');
    const errorVar = getComputedStyle(root).getPropertyValue('--error');
    const neutralBaseVar = getComputedStyle(root).getPropertyValue('--neutral-base');
    const accentVar = getComputedStyle(root).getPropertyValue('--accent');

    document.getElementById('warning-var')!.textContent = warningVar || 'not set';
    document.getElementById('warning-base-var')!.textContent = warningBaseVar || 'not set';
    document.getElementById('error-var')!.textContent = errorVar || 'not set';
    document.getElementById('neutral-base-var')!.textContent = neutralBaseVar || 'not set';
    document.getElementById('accent-var')!.textContent = accentVar || 'not set';

    console.log('🎨 CSS Variables Debug:', {
      warning: warningVar,
      warningBase: warningBaseVar,
      error: errorVar,
      neutralBase: neutralBaseVar,
      accent: accentVar
    });
  }, []);

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Color System Test</h1>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Neutral Colors</h2>
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-neutral-10 border border-gray-300 flex items-center justify-center text-xs">10%</div>
          <div className="w-16 h-16 bg-neutral-20 border border-gray-300 flex items-center justify-center text-xs">20%</div>
          <div className="w-16 h-16 bg-neutral-30 border border-gray-300 flex items-center justify-center text-xs">30%</div>
          <div className="w-16 h-16 bg-neutral-40 border border-gray-300 flex items-center justify-center text-xs">40%</div>
          <div className="w-16 h-16 bg-neutral-50 border border-gray-300 flex items-center justify-center text-xs">50%</div>
          <div className="w-16 h-16 bg-neutral border border-gray-300 flex items-center justify-center text-xs">100%</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Accent Colors</h2>
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-accent-10 border border-gray-300 flex items-center justify-center text-xs">10%</div>
          <div className="w-16 h-16 bg-accent-20 border border-gray-300 flex items-center justify-center text-xs">20%</div>
          <div className="w-16 h-16 bg-accent-30 border border-gray-300 flex items-center justify-center text-xs">30%</div>
          <div className="w-16 h-16 bg-accent-40 border border-gray-300 flex items-center justify-center text-xs">40%</div>
          <div className="w-16 h-16 bg-accent-50 border border-gray-300 flex items-center justify-center text-xs">50%</div>
          <div className="w-16 h-16 bg-accent border border-gray-300 flex items-center justify-center text-xs">100%</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Semantic Colors</h2>
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-success border border-gray-300 flex items-center justify-center text-xs">Success</div>
          <div className="w-16 h-16 bg-warning border border-gray-300 flex items-center justify-center text-xs">Warning</div>
          <div className="w-16 h-16 bg-error border border-gray-300 flex items-center justify-center text-xs">Error</div>
        </div>
        <div className="text-sm space-y-1">
          <div>CSS Variables:</div>
          <div className="font-mono text-xs">
            --warning: <span id="warning-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --warning-base: <span id="warning-base-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --error: <span id="error-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --neutral-base: <span id="neutral-base-var">loading...</span>
          </div>
          <div className="font-mono text-xs">
            --accent: <span id="accent-var">loading...</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Border Test</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-secondary border-2 border-neutral-20 rounded">Border 20%</button>
          <button className="px-4 py-2 bg-secondary border-2 border-neutral-40 rounded">Border 40%</button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Real Allocation Bar</h2>
        <div className="max-w-md">
          <AllocationBarBase
            pageId="test-page-id"
            authorId="test-author-id"
            pageTitle="Test Page"
            variant="default"
            source="test"
          />
        </div>
      </div>
    </div>
  );
}
