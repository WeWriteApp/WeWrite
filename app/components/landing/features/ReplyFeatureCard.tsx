"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '../../../lib/utils';

/**
 * Mini bar chart component for showing trends over time
 */
function BarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const width = 80;
  const height = 24;
  const barCount = data.length;
  const gap = 2;
  const barWidth = (width - (barCount - 1) * gap) / barCount;

  return (
    <svg width={width} height={height} className="opacity-80">
      {data.map((value, index) => {
        const barHeight = (value / max) * height;
        const x = index * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

/**
 * ReplyFeatureCard Component
 *
 * Shows a simplified preview of the reply functionality with agree/disagree/neutral chips
 * Stacked vertically with default card styling, colored chips only.
 */
export default function ReplyFeatureCard() {
  const replyTypes = [
    {
      type: 'agree',
      iconName: 'ThumbsUp' as const,
      label: 'Agree',
      chipBg: 'bg-green-500/15',
      chipText: 'text-green-600 dark:text-green-400',
      barColor: '#22c55e',
      count: 12,
      // Agrees increasing over time
      trend: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12]
    },
    {
      type: 'disagree',
      iconName: 'ThumbsDown' as const,
      label: 'Disagree',
      chipBg: 'bg-red-500/15',
      chipText: 'text-red-600 dark:text-red-400',
      barColor: '#ef4444',
      count: 3,
      // Disagrees decreasing over time
      trend: [10, 9, 8, 7, 6, 5, 4, 4, 3, 3]
    },
    {
      type: 'neutral',
      iconName: 'Minus' as const,
      label: 'Neutral',
      chipBg: 'bg-gray-500/15',
      chipText: 'text-gray-600 dark:text-gray-400',
      barColor: '#6b7280',
      count: 8,
      // Neutral with ups and downs
      trend: [4, 7, 5, 9, 6, 8, 5, 10, 7, 8]
    }
  ];

  return (
    <div className="flex flex-col gap-2 py-2">
      {replyTypes.map((replyType) => {
        return (
          <div
            key={replyType.type}
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
          >
            {/* Chip with icon, label, and count */}
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              replyType.chipBg,
              replyType.chipText
            )}>
              <Icon name={replyType.iconName} size={12} />
              <span>{replyType.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                "bg-black/10 dark:bg-white/10"
              )}>
                {replyType.count}
              </span>
            </div>
            {/* Bar chart on the right */}
            <BarChart data={replyType.trend} color={replyType.barColor} />
          </div>
        );
      })}
    </div>
  );
}
