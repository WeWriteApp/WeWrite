"use client";

import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../components/ui/accordion';
import { ComponentShowcase, StateDemo } from './shared';

export function AccordionSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Accordion"
      path="app/components/ui/accordion.tsx"
      description="Expandable content sections built on Radix UI. Supports single or multiple open items with animated transitions."
    >
      <StateDemo label="Single (only one open at a time)">
        <div className="w-full">
          <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger>What is WeWrite?</AccordionTrigger>
              <AccordionContent>
                WeWrite is a collaborative writing platform where everyone contributes to humanity&apos;s shared knowledge.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How do earnings work?</AccordionTrigger>
              <AccordionContent>
                Writers earn based on the quality and engagement of their contributions. Earnings are calculated monthly.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Can I customize my experience?</AccordionTrigger>
              <AccordionContent>
                Yes! You can choose accent colors, neutral tones, light/dark themes, and more from Settings.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </StateDemo>

      <StateDemo label="Multiple (several can be open)">
        <div className="w-full">
          <Accordion type="multiple">
            <AccordionItem value="features">
              <AccordionTrigger>Features</AccordionTrigger>
              <AccordionContent>
                Rich text editing, real-time collaboration, version history, and intelligent link suggestions.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pricing">
              <AccordionTrigger>Pricing</AccordionTrigger>
              <AccordionContent>
                Flexible subscription tiers with a free trial. Pay what you want, starting at $1/month.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </StateDemo>

      <StateDemo label="With Value Display">
        <div className="w-full">
          <Accordion type="single" collapsible>
            <AccordionItem value="plan">
              <AccordionTrigger value="Pro Plan">Current Plan</AccordionTrigger>
              <AccordionContent>
                You are on the Pro Plan with unlimited pages and priority support.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="storage">
              <AccordionTrigger value="2.4 GB">Storage Used</AccordionTrigger>
              <AccordionContent>
                You&apos;ve used 2.4 GB of your 10 GB storage quota.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
