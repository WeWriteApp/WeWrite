'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-alpha-5"
      style={{ flexShrink: 0, minWidth: 'max-content' }}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
        <span className="text-sm font-medium whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

export interface GroupStatsProps {
  memberCount: number;
  pageCount: number;
  createdAt?: string;
  visibility?: 'public' | 'private';
}

export default function GroupStats({
  memberCount,
  pageCount,
  createdAt,
  visibility,
}: GroupStatsProps) {
  const createdLabel = createdAt ? formatRelativeTime(createdAt) : '—';

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsCarousel, setNeedsCarousel] = useState(false);

  // Check if content overflows container (needs carousel)
  const checkOverflow = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const contentWidth = contentRef.current.offsetWidth;
    setNeedsCarousel(contentWidth > containerWidth);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(checkOverflow, 50);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [checkOverflow]);

  // Auto-scroll with seamless infinite loop
  useEffect(() => {
    if (!scrollContainerRef.current || !needsCarousel) return;

    const scrollContainer = scrollContainerRef.current;
    let animationId: number;
    const originalContentWidth = scrollContainer.scrollWidth / 2;
    const scrollSpeed = 0.3;

    const scroll = () => {
      if (scrollContainer) {
        scrollContainer.scrollLeft += scrollSpeed;
        if (scrollContainer.scrollLeft >= originalContentWidth) {
          scrollContainer.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    const timeoutId = setTimeout(() => {
      animationId = requestAnimationFrame(scroll);
    }, 100);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [needsCarousel]);

  const statItems = [
    {
      label: 'Members',
      value: memberCount.toString(),
      icon: <Icon name="Users" size={18} className="text-muted-foreground flex-shrink-0" />,
    },
    {
      label: 'Pages',
      value: pageCount.toString(),
      icon: <Icon name="FileText" size={18} className="text-muted-foreground flex-shrink-0" />,
    },
    {
      label: 'Created',
      value: createdLabel,
      icon: <Icon name="Calendar" size={18} className="text-muted-foreground flex-shrink-0" />,
    },
    ...(visibility === 'private'
      ? [
          {
            label: 'Visibility',
            value: 'Private',
            icon: <Icon name="Lock" size={18} className="text-muted-foreground flex-shrink-0" />,
          },
        ]
      : []),
  ];

  const statElements = statItems.map((stat) => (
    <StatItem key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
  ));

  return (
    <div className="mt-4 overflow-hidden rounded-xl" ref={containerRef}>
      <div
        ref={scrollContainerRef}
        className={`flex gap-2 overflow-x-auto scrollbar-hide ${!needsCarousel ? 'justify-center' : ''}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div ref={contentRef} className="flex gap-2" style={{ flexShrink: 0 }}>
          {statElements}
        </div>
        {needsCarousel && (
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            {statItems.map((stat) => (
              <StatItem
                key={`${stat.label}-dup`}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
