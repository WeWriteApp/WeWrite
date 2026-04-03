"use client";

import React, { useState, useRef, useCallback } from 'react';
import { ComponentShowcase, StateDemo, CollapsibleDocs } from './shared';
import { Icon } from '@/components/ui/Icon';
import { cn } from '../../lib/utils';
import { usePillClickAnimation, type PillClickAnimation } from '../../hooks/usePillClickAnimation';

// ─── Base click animations (from previous round) ───
const BASE_ANIMATIONS = [
  {
    name: 'pulse-glow' as const,
    label: 'Pulse Glow',
    className: 'pill-anim-pulse-glow',
    description: 'Subtle scale with an accent-colored ring that fades out.',
    duration: 450,
    isDefault: true,
  },
  { name: 'pop' as const, label: 'Pop', className: 'pill-anim-pop', description: 'Quick scale up then down — snappy and satisfying.', duration: 350 },
  { name: 'squish' as const, label: 'Squish', className: 'pill-anim-squish', description: 'Horizontal squeeze with vertical stretch — playful & organic.', duration: 400 },
  { name: 'jelly' as const, label: 'Jelly', className: 'pill-anim-jelly', description: 'Wobbly elastic bounce — fun and bouncy like jello.', duration: 500 },
  { name: 'ripple-out' as const, label: 'Ripple Out', className: 'pill-anim-ripple-out', description: 'Material-inspired ring that expands outward on click.', duration: 500 },
  { name: 'bounce-drop' as const, label: 'Bounce Drop', className: 'pill-anim-bounce-drop', description: 'Drops down slightly and bounces back — tactile gravity feel.', duration: 450 },
  { name: 'magnetic-snap' as const, label: 'Magnetic Snap', className: 'pill-anim-magnetic-snap', description: 'Pulls inward with a brightness flash, then snaps back out sharply.', duration: 400 },
  { name: 'confetti-burst' as const, label: 'Confetti Burst', className: 'pill-anim-confetti-burst', description: 'Pop with expanding double-ring — celebratory and energetic.', duration: 500 },
];

// ─── Reveal/transition variants (pulse glow + page reveal) ───
const REVEAL_VARIANTS: {
  name: PillClickAnimation;
  label: string;
  description: string;
  duration: number;
}[] = [
  {
    name: 'pulse-glow',
    label: 'Pulse Glow (default)',
    description: 'Glow ring + slight scale. No expand — navigation happens instantly. This is the locked-in default.',
    duration: 450,
  },
  {
    name: 'glow-fade',
    label: 'Glow Fade',
    description: 'Glow ring pulses, text blurs and fades out, pill disappears — page loads underneath.',
    duration: 500,
  },
  {
    name: 'glow-expand',
    label: 'Glow Expand',
    description: 'Pill expands into a full content page with back, logo, share, title, byline & skeleton. Back button reverses the animation.',
    duration: 700,
  },
  {
    name: 'glow-morph',
    label: 'Glow Morph',
    description: 'Glow, pill stretches into a full-width bar, then expands vertically and transitions to background color.',
    duration: 500,
  },
  {
    name: 'glow-zoom',
    label: 'Glow Zoom',
    description: 'Glow ring, text zooms toward the viewer and blurs away — feels like diving into the link.',
    duration: 450,
  },
];

// ─── Reusable animated pill (CSS-only, for base animations) ───
function AnimatedPill({
  animation,
  pillStyle = 'filled',
}: {
  animation: typeof BASE_ANIMATIONS[number];
  pillStyle?: 'filled' | 'outline' | 'text' | 'underlined';
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAnimation = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsAnimating(false);
    requestAnimationFrame(() => {
      setIsAnimating(true);
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        timeoutRef.current = null;
      }, animation.duration + 50);
    });
  }, [animation.duration]);

  const pillClasses = {
    filled: 'bg-primary text-primary-foreground border border-primary px-2 py-0.5',
    outline: 'bg-transparent text-primary border border-primary/70 px-2 py-0.5',
    text: 'bg-transparent text-primary font-bold border-none px-1',
    underlined: 'bg-transparent text-primary font-bold border-none underline px-1',
  };

  return (
    <button
      type="button"
      onClick={triggerAnimation}
      className={cn(
        'inline-flex items-center text-sm font-medium rounded-lg cursor-pointer select-none transition-colors duration-150',
        pillClasses[pillStyle],
        animation.className,
        isAnimating && 'is-animating'
      )}
    >
      <span className="pill-text">Example Link</span>
    </button>
  );
}

// ─── Reveal variant demo pill (uses the hook for overlay animations) ───
function RevealDemoPill({
  variant,
}: {
  variant: typeof REVEAL_VARIANTS[number];
}) {
  const pillRef = useRef<HTMLButtonElement>(null);
  const { animateAndNavigate } = usePillClickAnimation();

  const handleClick = useCallback(() => {
    if (!pillRef.current) return;
    // For demo: animate but navigate to current page (no real nav)
    animateAndNavigate(
      pillRef.current,
      () => {
        // No-op navigation for demo — in real usage this calls router.push
      },
      variant.name
    );
  }, [animateAndNavigate, variant.name]);

  return (
    <button
      ref={pillRef}
      type="button"
      onClick={handleClick}
      className="inline-flex items-center text-sm font-medium rounded-lg cursor-pointer select-none bg-primary text-primary-foreground px-2.5 py-1 transition-colors duration-150"
    >
      <span className="pill-text">{variant.label}</span>
    </button>
  );
}

// ─── Card for base animations ───
function AnimationCard({ animation }: { animation: typeof BASE_ANIMATIONS[number] }) {
  return (
    <div className={cn(
      'wewrite-card p-4 space-y-3',
      animation.isDefault && 'ring-2 ring-primary/50'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{animation.label}</h4>
            {animation.isDefault && (
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">.{animation.className}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{animation.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        {(['filled', 'outline', 'text', 'underlined'] as const).map((style) => (
          <div key={style} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{style}</span>
            <AnimatedPill animation={animation} pillStyle={style} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Card for reveal variants ───
function RevealCard({ variant }: { variant: typeof REVEAL_VARIANTS[number] }) {
  return (
    <div className={cn(
      'wewrite-card p-4 space-y-3',
      variant.name === 'pulse-glow' && 'ring-2 ring-primary/50'
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-foreground">{variant.label}</h4>
          {variant.name === 'pulse-glow' && (
            <span className="text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">{variant.description}</p>
      </div>
      <RevealDemoPill variant={variant} />
    </div>
  );
}

// ─── Main section ───
export function PillClickAnimationsSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Pill Link Click Animations"
      path="app/hooks/usePillClickAnimation.ts"
      description="Pulse Glow is locked in as the default click animation. Below are reveal/expand variants that animate the pill into a page transition."
    >
      {/* ═══ SECTION 1: Locked-in default ═══ */}
      <StateDemo label="Default: Pulse Glow (active on all pill links)">
        <div className="flex flex-wrap items-center gap-4">
          {(['filled', 'outline', 'text', 'underlined'] as const).map((style) => (
            <div key={style} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{style}</span>
              <AnimatedPill
                animation={BASE_ANIMATIONS[0]} // pulse-glow
                pillStyle={style}
              />
            </div>
          ))}
        </div>
      </StateDemo>

      {/* ═══ SECTION 2: Reveal / page transition variants ═══ */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon name="Sparkles" size={14} className="text-primary" />
          Page Reveal Variants
        </h3>
        <p className="text-xs text-muted-foreground">
          Click each pill to see how it animates the text away and transitions into the page.
          These combine Pulse Glow with expand/morph effects.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {REVEAL_VARIANTS.map((variant) => (
          <RevealCard key={variant.name} variant={variant} />
        ))}
      </div>

      {/* ═══ SECTION 3: All base animations (collapsed) ═══ */}
      <CollapsibleDocs type="notes" title="All Base Click Animations (8 variants)">
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          {BASE_ANIMATIONS.map((anim) => (
            <AnimationCard key={anim.name} animation={anim} />
          ))}
        </div>
      </CollapsibleDocs>

      {/* ═══ Implementation guide ═══ */}
      <CollapsibleDocs type="notes" title="Implementation Guide">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Pulse Glow</strong> is now wired into <code className="bg-muted px-1 rounded">PillLink.tsx</code> for
            all internal link clicks in view mode. The animation plays, then navigation fires mid-animation.
          </p>
          <p><strong>Reveal variants</strong> use the <code className="bg-muted px-1 rounded">usePillClickAnimation</code> hook:</p>
          <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`import { usePillClickAnimation } from '../../hooks/usePillClickAnimation';

const { animateAndNavigate } = usePillClickAnimation();

// On click:
animateAndNavigate(
  pillElement,          // The <a> DOM node
  () => router.push(url), // Navigation callback  
  'glow-expand'         // Animation variant
);`}
          </pre>
          <p><strong>Available variants:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="bg-muted px-1 rounded">pulse-glow</code> — Default. Glow ring only.</li>
            <li><code className="bg-muted px-1 rounded">glow-fade</code> — Text blurs out, pill fades.</li>
            <li><code className="bg-muted px-1 rounded">glow-expand</code> — Pill expands to fill viewport.</li>
            <li><code className="bg-muted px-1 rounded">glow-morph</code> — Pill morphs to full-width bar, then fills viewport.</li>
            <li><code className="bg-muted px-1 rounded">glow-zoom</code> — Text zooms toward viewer and fades.</li>
          </ul>
        </div>
      </CollapsibleDocs>
    </ComponentShowcase>
  );
}
