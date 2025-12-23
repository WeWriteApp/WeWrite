"use client";

import React from 'react';
import { ComponentShowcase, StateDemo } from './shared';

export function TypographySection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Typography"
      path="app/globals.css"
      description="Text styles and hierarchy used throughout the application"
    >
      <StateDemo label="Headings">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Heading 1</h1>
          <h2 className="text-3xl font-bold">Heading 2</h2>
          <h3 className="text-2xl font-semibold">Heading 3</h3>
          <h4 className="text-xl font-semibold">Heading 4</h4>
          <h5 className="text-lg font-medium">Heading 5</h5>
          <h6 className="text-base font-medium">Heading 6</h6>
        </div>
      </StateDemo>

      <StateDemo label="Body Text">
        <div className="space-y-2">
          <p className="text-base">Regular body text with normal weight and size.</p>
          <p className="text-sm">Small text for captions and secondary information.</p>
          <p className="text-xs">Extra small text for fine print and metadata.</p>
          <p className="text-base font-medium">Medium weight text for emphasis.</p>
          <p className="text-base font-semibold">Semibold text for stronger emphasis.</p>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
