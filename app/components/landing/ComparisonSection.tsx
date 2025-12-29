"use client";

import React, { useRef } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { LandingCard, LandingCardText } from './LandingCard';

/**
 * ComparisonSection Component
 *
 * Shows how WeWrite differs from competitors in a swipeable carousel.
 * Each competitor has their brand icon and a list of key differences.
 */

// Substack logo SVG
function SubstackLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
    </svg>
  );
}

// Patreon logo SVG
function PatreonLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z" />
    </svg>
  );
}

// Apple logo SVG
function AppleLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// Obsidian logo SVG
function ObsidianLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z" />
    </svg>
  );
}

// Wikipedia logo SVG
function WikipediaLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l2.681-5.392-2.028-4.419c-.114-.271-.215-.428-.334-.522-.121-.094-.332-.15-.651-.168l-.463-.028c-.163 0-.227-.053-.227-.182v-.443l.051-.04h4.659l.051.04v.455c0 .119-.074.176-.203.176-.39.008-.619.031-.686.068-.069.04-.069.152 0 .37l1.351 2.997 1.399-2.814c.175-.384.175-.61 0-.676-.174-.068-.42-.107-.725-.115-.075-.004-.15-.009-.225-.014-.15 0-.225-.055-.225-.182v-.443l.06-.04h4.002l.051.04v.455c0 .119-.075.176-.225.176-.614.023-1.049.133-1.304.344-.256.21-.494.6-.721 1.177l-2.043 4.33 2.594 5.445s3.76-7.699 4.92-10.521c.15-.465.226-.765.226-.9 0-.295-.255-.46-.766-.495l-.549-.031c-.15 0-.225-.057-.225-.176v-.434l.051-.045c.81.005 4.861 0 4.861 0l.052.045v.455c0 .119-.075.176-.225.176-.693.03-1.237.147-1.634.346-.396.2-.737.581-1.021 1.144l-5.176 10.93c-.54 1.125-.997 1.035-1.378-.054l-2.94-6.269z" />
    </svg>
  );
}

interface DifferenceItem {
  text: string;
  icon: string; // Lucide icon name
}

interface ComparisonData {
  id: string;
  name: string;
  brandColor: string; // Brand color for the icon background
  renderIcon: (props: { size: number; className?: string }) => React.ReactNode;
  differences: DifferenceItem[];
}

const COMPARISONS: ComparisonData[] = [
  {
    id: 'substack',
    name: 'Substack',
    brandColor: '#FF6719',
    renderIcon: ({ size, className }) => <SubstackLogo size={size} className={className} />,
    differences: [
      { text: 'Substack posts are static once published. WeWrite pages evolve—edit, update, and refine over time!', icon: 'RefreshCw' },
      { text: 'Substack locks content behind paywalls. WeWrite keeps everything open—everyone can read, always', icon: 'Unlock' },
      { text: 'Substack means subscribing per-newsletter. WeWrite readers split one subscription across all their favorite writers', icon: 'Percent' },
      { text: 'Substack is a blog feed. WeWrite pages link together to form an interconnected web of ideas', icon: 'Link' },
    ],
  },
  {
    id: 'patreon',
    name: 'Patreon',
    brandColor: '#FF424D',
    renderIcon: ({ size, className }) => <PatreonLogo size={size} className={className} />,
    differences: [
      { text: 'Patreon locks content behind tiers. WeWrite keeps everything open—every page is a mini-fundraiser!', icon: 'Network' },
      { text: 'Patreon communities stay siloed. WeWrite communities connect and cross-pollinate ideas', icon: 'Users' },
      { text: 'Patreon requires managing complex tiers. WeWrite readers just allocate what feels right to pages they love', icon: 'Settings' },
      { text: 'Patreon content is members-only. WeWrite lives on the open web, discoverable by anyone', icon: 'Globe' },
    ],
  },
  {
    id: 'apple-notes',
    name: 'Apple Notes',
    brandColor: '#FFCC00',
    renderIcon: ({ size, className }) => <AppleLogo size={size} className={className} />,
    differences: [
      { text: 'Apple Notes keeps ideas in a locked drawer. WeWrite is built for sharing with an audience!', icon: 'Lock' },
      { text: 'Apple Notes requires Apple devices. WeWrite works everywhere—just open your browser', icon: 'Globe' },
      { text: 'Apple Notes has no discovery. WeWrite helps readers find you through trending pages and feeds', icon: 'Search' },
      { text: 'Apple Notes collaboration is clunky. WeWrite is social-first with seamless real-time features', icon: 'Users' },
    ],
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    brandColor: '#7C3AED',
    renderIcon: ({ size, className }) => <ObsidianLogo size={size} className={className} />,
    differences: [
      { text: 'Obsidian is powerful but private. WeWrite is "Obsidian Social"—linking meets community!', icon: 'Users' },
      { text: 'Obsidian vaults stay on your device. WeWrite lets you build your knowledge graph in public', icon: 'Share2' },
      { text: 'Obsidian links stay in your vault. WeWrite links connect you to other writers\' ideas too', icon: 'Link' },
      { text: 'Obsidian needs plugins and sync fees. WeWrite works instantly in your browser, free', icon: 'Zap' },
    ],
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    brandColor: '#000000',
    renderIcon: ({ size, className }) => <WikipediaLogo size={size} className={className} />,
    differences: [
      { text: 'Wikipedia forces one consensus per topic. WeWrite lets everyone have their own perspective!', icon: 'Users' },
      { text: 'Wikipedia editors are anonymous. WeWrite writers build personal brands and earn from expertise', icon: 'UserCircle' },
      { text: 'Wikipedia requires "neutral point of view." WeWrite welcomes hot takes and unique viewpoints', icon: 'MessageSquare' },
      { text: 'Wikipedia has strict notability rules. WeWrite lets you write about anything you want', icon: 'Sparkles' },
    ],
  },
];

export default function ComparisonSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How WeWrite is Different
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how WeWrite compares to other platforms
          </p>
        </div>

        {/* Scrollable Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {COMPARISONS.map((comparison) => (
            <div
              key={comparison.id}
              className="flex-shrink-0 w-[320px] md:w-[380px] snap-center"
            >
              <LandingCard className="h-full" padding="lg">
                <div className="space-y-5">
                  {/* Header with Stacked Diagonal Logos */}
                  <div className="flex flex-col items-center text-center">
                    {/* Stacked logos container */}
                    <div className="relative w-[80px] h-14 mb-3">
                      {/* WeWrite logo (left, tilted left) */}
                      <div className="absolute left-0 top-0 w-11 h-11 rounded-xl bg-background overflow-hidden transform -rotate-6 z-10 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                        <Image
                          src="/images/logos/logo-light.svg"
                          alt="WeWrite"
                          width={44}
                          height={44}
                          className="w-full h-full object-cover dark:hidden"
                        />
                        <Image
                          src="/images/logos/logo-dark.svg"
                          alt="WeWrite"
                          width={44}
                          height={44}
                          className="w-full h-full object-cover hidden dark:block absolute inset-0"
                        />
                      </div>
                      {/* Competitor logo (right, tilted right, overlapping) */}
                      <div
                        className="absolute left-9 top-1 w-11 h-11 rounded-xl flex items-center justify-center transform rotate-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                        style={{ backgroundColor: comparison.brandColor }}
                      >
                        {comparison.renderIcon({ size: 22, className: 'text-white' })}
                      </div>
                    </div>
                    {/* Comparison title */}
                    <LandingCardText as="h3" className="text-lg font-bold">
                      WeWrite vs {comparison.name}
                    </LandingCardText>
                  </div>

                  {/* Differences List */}
                  <ul className="space-y-3">
                    {comparison.differences.map((difference, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <Icon
                            name={difference.icon}
                            size={18}
                            className="text-primary"
                          />
                        </div>
                        <LandingCardText className="text-sm leading-relaxed">
                          {difference.text}
                        </LandingCardText>
                      </li>
                    ))}
                  </ul>
                </div>
              </LandingCard>
            </div>
          ))}
        </div>

        {/* Scroll indicator dots */}
        <div className="flex justify-center gap-2 mt-4">
          {COMPARISONS.map((comparison) => (
            <div
              key={comparison.id}
              className="w-2 h-2 rounded-full bg-muted-foreground/30"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
