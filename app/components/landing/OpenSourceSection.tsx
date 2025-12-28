"use client";

import React from 'react';
import { LandingCard, LandingCardText } from './LandingCard';
import { Button } from '../ui/button';
import { Github } from 'lucide-react';
import { useLandingColors } from './LandingColorContext';

/**
 * OpenSourceSection Component
 *
 * Highlights that WeWrite is fully open source with a prominent GitHub CTA.
 * Uses LandingCard for consistent styling with other landing page components.
 */
export default function OpenSourceSection() {
  const colors = useLandingColors();

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <LandingCard
          padding="xl"
          hoverable={false}
        >
          <div className="text-center space-y-6">
            {/* GitHub Icon - Large and Prominent */}
            <div className="flex justify-center">
              <div
                className="p-6 rounded-2xl inline-flex"
                style={{
                  backgroundColor: colors.cardBg,
                  borderColor: colors.cardBorder,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                <Github
                  size={64}
                  className="text-current"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-3">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
                <LandingCardText as="span">
                  Fully Open Source
                </LandingCardText>
              </h2>
              <p className="text-lg md:text-xl max-w-2xl mx-auto">
                <LandingCardText as="span" muted>
                  WeWrite is built in the open. View our code, contribute features, or fork it to build your own platform.
                </LandingCardText>
              </p>
            </div>

            {/* GitHub Stats (Placeholder) */}
            <div className="flex items-center justify-center gap-6 py-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                <LandingCardText as="span" className="text-sm font-medium">
                  100+ stars
                </LandingCardText>
              </div>
              <div className="w-px h-4" style={{ backgroundColor: colors.cardBorder }} />
              <LandingCardText as="span" muted className="text-sm">
                MIT License
              </LandingCardText>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <Button
                asChild
                size="lg"
                className="text-base font-semibold"
              >
                <a
                  href="https://github.com/WeWriteApp/WeWrite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github size={20} />
                  Star on GitHub
                </a>
              </Button>
            </div>

            {/* Additional Context */}
            <div className="pt-4 max-w-xl mx-auto">
              <LandingCardText as="p" muted className="text-sm">
                Built with Next.js, Firebase, and modern web technologies. All code is available under the MIT license.
              </LandingCardText>
            </div>
          </div>
        </LandingCard>
      </div>
    </section>
  );
}
