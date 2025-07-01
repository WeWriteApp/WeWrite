"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface PlaceholderProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  animate?: boolean;
  children?: React.ReactNode;
}

/**
 * Placeholder component to prevent layout shifts
 * 
 * @param className Additional CSS classes
 * @param width Width of the placeholder (default: 100%)
 * @param height Height of the placeholder
 * @param animate Whether to show animation (default: true)
 * @param children Optional children to render inside the placeholder
 */
export function Placeholder({
  className,
  width = "100%",
  height,
  animate = true,
  children
}: PlaceholderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md",
        animate && "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        animate ? "bg-muted/40" : "bg-muted/20",
        className
      )}
      style={{
        width,
        height,
        minHeight: height
      }}
    >
      {children}
    </div>
  );
}

/**
 * Image placeholder with gradient background
 */
export function ImagePlaceholder({
  className,
  width = "100%",
  height,
  animate = true
}: PlaceholderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-gradient-to-br from-blue-500/30 to-emerald-500/30",
        className
      )}
      style={{
        width,
        height,
        minHeight: height
      }}
    >
      {/* Optional shimmer effect */}
      {animate && (
        <div className="absolute inset-0 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
      )}
    </div>
  );
}