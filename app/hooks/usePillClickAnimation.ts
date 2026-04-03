"use client";

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Pill link click animation variants.
 *
 * - pulse-glow: Default. Quick glow ring + slight scale. No page reveal.
 * - glow-fade: Glow + text blurs out, pill fades away, then navigate.
 * - glow-expand: Glow, pill expands into a full content page overlay with back button.
 * - glow-morph: Glow, pill morphs into a page-width bar, transitions to bg color.
 * - glow-zoom: Glow, text zooms toward viewer and fades, then navigate.
 */
export type PillClickAnimation =
  | 'pulse-glow'
  | 'glow-fade'
  | 'glow-expand'
  | 'glow-morph'
  | 'glow-zoom';

const ANIMATION_DURATIONS: Record<PillClickAnimation, number> = {
  'pulse-glow': 450,
  'glow-fade': 500,
  'glow-expand': 700,
  'glow-morph': 500,
  'glow-zoom': 450,
};

// Inline SVG icons (Lucide) to avoid React component limitations in raw DOM
const ICON_CHEVRON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const ICON_SHARE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Hook that provides a function to play the pill click animation,
 * then perform navigation after the animation completes.
 *
 * For simple animations (pulse-glow, glow-fade, glow-zoom):
 *   Toggles .is-animating on the pill element.
 *
 * For overlay animations (glow-expand, glow-morph):
 *   Creates a fixed-position overlay that starts at the pill's position
 *   and transitions to fill the viewport.
 *
 * glow-expand specifically creates a full content-page replica with a
 * functional back button that reverses the animation.
 */
export function usePillClickAnimation() {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = useCallback(() => {
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = null;
    }
    for (const t of cleanupTimeoutsRef.current) {
      clearTimeout(t);
    }
    cleanupTimeoutsRef.current = [];
  }, []);

  const cleanupOverlay = useCallback(() => {
    clearAllTimeouts();
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }
  }, [clearAllTimeouts]);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    cleanupTimeoutsRef.current.push(id);
    return id;
  }, []);

  /**
   * Animate a pill link click and navigate after the animation.
   *
   * @param pillElement The <a> element that was clicked
   * @param navigateFn A function that performs navigation (called after animation)
   * @param animation Which animation variant to play
   */
  const animateAndNavigate = useCallback((
    pillElement: HTMLElement,
    navigateFn: () => void,
    animation: PillClickAnimation = 'pulse-glow'
  ) => {
    const duration = ANIMATION_DURATIONS[animation];

    // --- Simple element-level animations ---
    if (animation === 'pulse-glow' || animation === 'glow-fade' || animation === 'glow-zoom') {
      const animClass =
        animation === 'pulse-glow' ? 'pill-anim-pulse-glow' :
        animation === 'glow-fade' ? 'pill-anim-glow-fade' :
        'pill-anim-glow-zoom';

      pillElement.classList.add(animClass);
      pillElement.classList.remove('is-animating');
      void pillElement.offsetWidth;
      pillElement.classList.add('is-animating');

      const navDelay = animation === 'pulse-glow' ? duration * 0.5 : duration * 0.6;
      setTimeout(() => {
        navigateFn();
      }, navDelay);

      setTimeout(() => {
        pillElement.classList.remove('is-animating', animClass);
      }, duration + 50);

      return;
    }

    // --- Overlay-based reveal animations ---
    cleanupOverlay();

    const rect = pillElement.getBoundingClientRect();
    const pillText = pillElement.querySelector('.pill-text')?.textContent || '';

    // ═══════════════════════════════════════════════════════
    // GLOW EXPAND — Full content page transition
    // ═══════════════════════════════════════════════════════
    if (animation === 'glow-expand') {
      const safeText = escapeHtml(pillText);

      // Create overlay starting at pill position
      const overlay = document.createElement('div');
      overlay.className = 'pill-reveal-overlay variant-glow-expand';
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      // Store original pill rect for reverse animation
      overlay.dataset.pillTop = `${rect.top}`;
      overlay.dataset.pillLeft = `${rect.left}`;
      overlay.dataset.pillWidth = `${rect.width}`;
      overlay.dataset.pillHeight = `${rect.height}`;

      // Pill text (visible during initial glow, fades during expand)
      const textSpan = document.createElement('span');
      textSpan.className = 'pill-reveal-text';
      textSpan.textContent = pillText;
      overlay.appendChild(textSpan);

      // Full content page structure (hidden until expanded)
      const pageContent = document.createElement('div');
      pageContent.className = 'pill-expand-page-content';
      pageContent.innerHTML = `
        <div class="pill-expand-header-bar">
          <div class="pill-expand-header-row1">
            <button class="pill-expand-back-btn" aria-label="Go back" type="button">
              ${ICON_CHEVRON_LEFT}
            </button>
            <div class="pill-expand-logo">
              <img src="/images/logos/logo-dark.svg" alt="" class="pill-expand-logo-dark" width="28" height="28" />
              <img src="/images/logos/logo-light.svg" alt="" class="pill-expand-logo-light" width="28" height="28" />
            </div>
            <button class="pill-expand-share-btn" aria-label="Share" type="button">
              ${ICON_SHARE}
            </button>
          </div>
          <h1 class="pill-expand-title">${safeText}</h1>
          <div class="pill-expand-byline">
            <span class="pill-expand-byline-dot"></span>
            <span class="pill-expand-byline-bar"></span>
          </div>
        </div>
        <div class="pill-expand-body">
          <div class="pill-expand-line" style="width:92%"></div>
          <div class="pill-expand-line" style="width:100%"></div>
          <div class="pill-expand-line" style="width:85%"></div>
          <div class="pill-expand-line" style="width:78%"></div>
          <div class="pill-expand-line-gap"></div>
          <div class="pill-expand-line" style="width:95%"></div>
          <div class="pill-expand-line" style="width:88%"></div>
          <div class="pill-expand-line" style="width:70%"></div>
        </div>
      `;
      overlay.appendChild(pageContent);

      document.body.appendChild(overlay);
      overlayRef.current = overlay;

      // Hide original pill
      pillElement.style.opacity = '0';

      // Force reflow
      void overlay.offsetWidth;

      // --- Back button handler: reverse the animation ---
      const backBtn = overlay.querySelector('.pill-expand-back-btn') as HTMLButtonElement | null;
      if (backBtn) {
        backBtn.addEventListener('click', (e) => {
          e.stopPropagation();

          // Cancel pending navigation
          clearAllTimeouts();

          // Phase A: Fade out page content
          overlay.classList.remove('is-page-visible');
          overlay.classList.add('is-collapsing');

          // Phase B: After content fades, shrink back to pill
          addTimeout(() => {
            overlay.style.top = `${overlay.dataset.pillTop}px`;
            overlay.style.left = `${overlay.dataset.pillLeft}px`;
            overlay.style.width = `${overlay.dataset.pillWidth}px`;
            overlay.style.height = `${overlay.dataset.pillHeight}px`;
            overlay.style.borderRadius = '8px';
          }, 150);

          // Phase C: Fade out overlay, restore pill
          addTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease-out';
          }, 450);

          addTimeout(() => {
            pillElement.style.opacity = '';
            if (overlayRef.current) {
              overlayRef.current.remove();
              overlayRef.current = null;
            }
          }, 680);
        });
      }

      // Phase 1: Brief glow at pill position
      overlay.style.boxShadow = '0 0 0 6px oklch(var(--accent-base) / 0.3)';

      // Phase 2: Expand to viewport
      requestAnimationFrame(() => {
        addTimeout(() => {
          overlay.classList.add('is-expanding');
          overlay.style.top = '0px';
          overlay.style.left = '0px';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
          overlay.style.borderRadius = '0';
          overlay.style.boxShadow = 'none';
        }, 100);

        // Phase 3: Show page content
        addTimeout(() => {
          overlay.classList.add('is-page-visible');
        }, 320);
      });

      // Navigate once expanded
      navTimeoutRef.current = addTimeout(() => {
        navigateFn();
      }, duration * 0.75);

      // Fade out overlay so real page shows through
      addTimeout(() => {
        if (overlayRef.current) {
          overlayRef.current.style.opacity = '0';
          overlayRef.current.style.transition = 'opacity 0.25s ease-out';
        }
      }, duration + 150);

      addTimeout(() => {
        pillElement.style.opacity = '';
        cleanupOverlay();
      }, duration + 450);

      return;
    }

    // ═══════════════════════════════════════════════════════
    // GLOW MORPH
    // ═══════════════════════════════════════════════════════
    const overlay = document.createElement('div');
    overlay.className = `pill-reveal-overlay variant-${animation}`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const textSpan = document.createElement('span');
    textSpan.className = 'pill-reveal-text';
    textSpan.textContent = pillText;
    textSpan.style.cssText = `
      color: oklch(var(--primary-foreground));
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
    `;
    overlay.appendChild(textSpan);

    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    pillElement.style.opacity = '0';
    void overlay.offsetWidth;

    overlay.style.boxShadow = `0 0 0 6px oklch(var(--accent-base) / 0.3)`;

    requestAnimationFrame(() => {
      setTimeout(() => {
        overlay.style.left = '0px';
        overlay.style.width = '100vw';
        overlay.style.height = `${rect.height + 8}px`;
        overlay.style.borderRadius = '0';
        overlay.style.boxShadow = 'none';

        setTimeout(() => {
          overlay.style.top = '0px';
          overlay.style.height = '100vh';
          overlay.style.background = 'oklch(var(--background))';
        }, 180);
      }, 100);
    });

    setTimeout(() => {
      navigateFn();
    }, duration * 0.55);

    setTimeout(() => {
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '0';
        overlayRef.current.style.transition = 'opacity 0.2s ease-out';
      }
    }, duration);

    setTimeout(() => {
      cleanupOverlay();
      pillElement.style.opacity = '';
    }, duration + 250);
  }, [cleanupOverlay, clearAllTimeouts, addTimeout, router]);

  return { animateAndNavigate };
}
