'use client';

import React from 'react';

interface TokenPieChartProps {
  allocatedTokens: number;
  totalTokens: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  onClick?: () => void;
}

export function TokenPieChart({
  allocatedTokens,
  totalTokens,
  size = 32,
  strokeWidth = 3,
  className = '',
  onClick
}: TokenPieChartProps) {
  const percentage = totalTokens > 0 ? (allocatedTokens / totalTokens) * 100 : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className={`flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      title={`${allocatedTokens} tokens allocated out of ${totalTokens} total monthly tokens`}
    >
      {/* Pie Chart SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted-foreground/20"
          />
          
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-primary transition-all duration-300 ease-in-out"
          />
        </svg>
        
        {/* Center percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      
      {/* Fraction text */}
      <span className="text-sm font-medium text-foreground">
        {allocatedTokens}/{totalTokens}
      </span>
    </div>
  );
}
