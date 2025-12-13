"use client";

/**
 * CompositionBar Component
 *
 * A shared visual component that displays the allocation distribution across:
 * - Other pages (previously allocated)
 * - Current page (funded portion with animations)
 * - Current page (overfunded portion)
 * - Available funds
 *
 * Used by:
 * - AllocationBar (floating action bar)
 * - EmbeddedAllocationBar (card-based allocation)
 * - AllocationBarBase (page header allocation)
 *
 * Features:
 * - Particle animation on allocation increase
 * - Pulse animation on allocation increase
 * - Smooth transitions between states
 * - Responsive sizing (sm, md, lg)
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { ALLOCATION_BAR_STYLES } from '../../constants/allocation-styles';
import { ParticleAnimation, PulseAnimation } from '../ui/ParticleAnimation';

export interface CompositionBarData {
  otherPagesPercentage: number;
  currentPageFundedPercentage: number;
  currentPageOverfundedPercentage: number;
  availablePercentage: number;
  isOutOfFunds: boolean;
}

export interface CompositionBarProps {
  /** Composition data for the bar segments */
  data: CompositionBarData;
  /** Whether to show pulse animation */
  showPulse?: boolean;
  /** Whether to show particle animation */
  showParticles?: boolean;
  /** Callback when pulse animation completes */
  onPulseComplete?: () => void;
  /** Callback when particle animation completes */
  onParticlesComplete?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Enable shiny mode styling */
  isShinyMode?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler for the bar */
  onClick?: (e: React.MouseEvent) => void;
  /** Whether clicking is enabled */
  clickable?: boolean;
}

const sizeClasses = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
};

export function CompositionBar({
  data,
  showPulse = false,
  showParticles = false,
  onPulseComplete,
  onParticlesComplete,
  size = 'md',
  isShinyMode = false,
  className,
  onClick,
  clickable = false,
}: CompositionBarProps) {
  const {
    otherPagesPercentage,
    currentPageFundedPercentage,
    currentPageOverfundedPercentage,
    availablePercentage,
  } = data;

  // Calculate width for "other" section with minimum visibility
  const otherWidth = otherPagesPercentage > 0
    ? `max(${otherPagesPercentage}%, 4px)`
    : '0%';

  return (
    <div
      className={cn(
        "relative flex-1",
        sizeClasses[size],
        clickable && "cursor-pointer",
        className
      )}
      onClick={clickable ? onClick : undefined}
    >
      {/* Background composition bar with smooth transitions */}
      <div className="absolute inset-0 flex gap-1 pointer-events-none">
        {/* Other pages (spent elsewhere) - left side */}
        {otherPagesPercentage > 0 && (
          <div
            className={ALLOCATION_BAR_STYLES.sections.other}
            style={{ width: otherWidth }}
          />
        )}

        {/* Current page - funded portion with game-like animations */}
        {currentPageFundedPercentage > 0 && (
          <div
            className={cn(
              "bg-primary rounded-md transition-all duration-300 ease-out relative",
              showPulse && "animate-allocation-pulse",
              isShinyMode && "allocation-bar-shiny-style"
            )}
            style={{ width: `${currentPageFundedPercentage}%`, overflow: 'visible' }}
          >
            {/* Pulse animation overlay */}
            <PulseAnimation
              trigger={showPulse}
              onComplete={onPulseComplete}
              className="bg-primary rounded-md"
              intensity={1.05}
            />
            {/* Particle animation - emits from center, fades in as it moves outward */}
            <ParticleAnimation
              trigger={showParticles}
              onComplete={onParticlesComplete}
              particleCount={6}
              duration={800}
              color="hsl(var(--primary))"
              fadeInDistance={40}
            />
          </div>
        )}

        {/* Current page - overfunded portion */}
        {currentPageOverfundedPercentage > 0 && (
          <div
            className={ALLOCATION_BAR_STYLES.sections.overspent}
            style={{ width: `${currentPageOverfundedPercentage}%` }}
          />
        )}

        {/* Available funds - right side (outline style) */}
        {availablePercentage > 0 && (
          <div
            className={ALLOCATION_BAR_STYLES.sections.available}
            style={{ width: `${availablePercentage}%` }}
          />
        )}
      </div>

      {/* Particle animation for first allocation (when funded percentage is 0 but particles triggered) */}
      {currentPageFundedPercentage === 0 && showParticles && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ overflow: 'visible' }}>
          <ParticleAnimation
            trigger={showParticles}
            onComplete={onParticlesComplete}
            particleCount={6}
            duration={800}
            color="hsl(var(--primary))"
            fadeInDistance={40}
          />
        </div>
      )}
    </div>
  );
}

export default CompositionBar;
