"use client";

import React from 'react';
import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * Mini sparkline component for showing trends
 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      icon: ThumbsUp,
      label: 'Agree',
      chipBg: 'bg-green-500/15',
      chipText: 'text-green-600 dark:text-green-400',
      sparkColor: '#22c55e',
      count: 12,
      trend: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      type: 'disagree',
      icon: ThumbsDown,
      label: 'Disagree',
      chipBg: 'bg-red-500/15',
      chipText: 'text-red-600 dark:text-red-400',
      sparkColor: '#ef4444',
      count: 5,
      trend: [8, 7, 6, 5, 5, 5, 5, 5, 5, 5]
    },
    {
      type: 'neutral',
      icon: Minus,
      label: 'Neutral',
      chipBg: 'bg-gray-500/15',
      chipText: 'text-gray-600 dark:text-gray-400',
      sparkColor: '#6b7280',
      count: 8,
      trend: [5, 7, 6, 8, 7, 9, 8, 7, 8, 8]
    }
  ];

  return (
    <div className="flex flex-col gap-2 py-2">
      {replyTypes.map((replyType) => {
        const Icon = replyType.icon;
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
              <Icon className="w-3 h-3" />
              <span>{replyType.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                "bg-black/10 dark:bg-white/10"
              )}>
                {replyType.count}
              </span>
            </div>
            {/* Sparkline on the right */}
            <Sparkline data={replyType.trend} color={replyType.sparkColor} />
          </div>
        );
      })}
    </div>
  );
}
