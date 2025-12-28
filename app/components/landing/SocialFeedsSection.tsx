"use client";

import React from 'react';
import { LandingCard, LandingCardText } from './LandingCard';
import { Icon } from '@/components/ui/Icon';

// X (Twitter) logo SVG component
function XLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * SocialFeedsSection Component
 *
 * Displays Instagram and X as large clickable cards.
 */
export default function SocialFeedsSection() {
  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Instagram Card */}
          <a
            href="https://www.instagram.com/getwewrite/"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <LandingCard padding="lg" hoverable className="flex flex-col items-center text-center py-12">
              <div className="p-5 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 mb-6">
                <Icon name="Instagram" size={48} className="text-white" />
              </div>
              <LandingCardText as="h3" className="text-2xl font-semibold mb-2">
                Instagram
              </LandingCardText>
              <LandingCardText as="p" muted className="text-lg">
                @getwewrite
              </LandingCardText>
            </LandingCard>
          </a>

          {/* X Card */}
          <a
            href="https://x.com/WeWriteApp"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <LandingCard padding="lg" hoverable className="flex flex-col items-center text-center py-12">
              <div className="p-5 rounded-full bg-black mb-6">
                <XLogo size={48} className="text-white" />
              </div>
              <LandingCardText as="h3" className="text-2xl font-semibold mb-2">
                X
              </LandingCardText>
              <LandingCardText as="p" muted className="text-lg">
                @WeWriteApp
              </LandingCardText>
            </LandingCard>
          </a>
        </div>
      </div>
    </section>
  );
}
