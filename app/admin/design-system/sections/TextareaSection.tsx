"use client";

import React, { useState } from 'react';
import { Textarea } from '../../../components/ui/textarea';
import { ComponentShowcase, StateDemo } from './shared';

export function TextareaSection({ id }: { id: string }) {
  const [textareaValue, setTextareaValue] = useState('');

  return (
    <ComponentShowcase
      id={id}
      title="Textarea"
      path="app/components/ui/textarea.tsx"
      description="Multi-line glassmorphic text input with resize capabilities"
    >
      <StateDemo label="Basic Textarea">
        <Textarea
          placeholder="Enter your message..."
          value={textareaValue}
          onChange={(e) => setTextareaValue(e.target.value)}
          className="w-full max-w-md"
          rows={4}
        />
      </StateDemo>

      <StateDemo label="States">
        <Textarea placeholder="Normal" className="w-full max-w-md" rows={3} />
        <Textarea placeholder="Disabled" disabled className="w-full max-w-md" rows={3} />
        <Textarea
          placeholder="With content"
          value="This is sample content in a textarea that demonstrates how text wraps and displays."
          readOnly
          className="w-full max-w-md"
          rows={3}
        />
        <Textarea placeholder="Error state" error errorText="This field is required" className="w-full max-w-md" rows={3} />
        <Textarea placeholder="Warning state" warning warningText="This might cause issues" className="w-full max-w-md" rows={3} />
      </StateDemo>
    </ComponentShowcase>
  );
}
