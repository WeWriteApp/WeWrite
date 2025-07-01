"use client";

/**
 * Mobile optimization utilities for SEO and user experience
 */

interface ValidationResult {
  valid: boolean;
  issues: string[];
  suggestions: string[];
  score: number;
}

interface PerformanceResult {
  issues: string[];
  suggestions: string[];
  score: number;
}

// Extend Navigator interface for connection
declare global {
  interface Navigator {
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
    };
  }
  interface Window {
    gtag?: (...args: any[]) => void;
    orientation?: number;
  }
}

/**
 * Validates mobile-friendly design elements
 */
export function validateMobileFriendly(container: Document | HTMLElement = document): ValidationResult {
  if (typeof window === 'undefined') return { valid: true, issues: [], suggestions: [], score: 100 };

  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check viewport meta tag
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    issues.push('Missing viewport meta tag');
    suggestions.push('Add <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  } else {
    const content = viewportMeta.getAttribute('content');
    if (content && !content.includes('width=device-width')) {
      issues.push('Viewport meta tag missing width=device-width');
      suggestions.push('Update viewport meta tag to include width=device-width');
    }
  }
  
  // Check for touch-friendly elements
  const clickableElements = container.querySelectorAll('button, a, input, select, textarea');
  clickableElements.forEach((element: Element) => {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    // Check minimum touch target size (44px recommended)
    const minSize = 44;
    if (rect.width < minSize || rect.height < minSize) {
      const padding = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
      if (rect.height + padding < minSize) {
        issues.push(`Touch target too small: ${element.tagName} (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
        suggestions.push('Increase touch target size to at least 44x44px');
      }
    }
  });
  
  // Check for horizontal scrolling
  if (document.body.scrollWidth > window.innerWidth) {
    issues.push('Horizontal scrolling detected');
    suggestions.push('Ensure content fits within viewport width');
  }
  
  // Check font sizes
  const textElements = container.querySelectorAll('p, span, div, li, td, th');
  textElements.forEach((element: Element) => {
    const computedStyle = window.getComputedStyle(element);
    const fontSize = parseFloat(computedStyle.fontSize);
    
    if (fontSize < 16) {
      issues.push(`Small font size detected: ${fontSize}px`);
      suggestions.push('Use minimum 16px font size for body text');
    }
  });
  
  // Check for fixed positioning that might interfere with mobile
  const fixedElements = container.querySelectorAll('*');
  Array.from(fixedElements).forEach((element: Element) => {
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'fixed') {
      const rect = element.getBoundingClientRect();
      if (rect.height > window.innerHeight * 0.3) {
        issues.push('Large fixed element detected that may interfere with mobile navigation');
        suggestions.push('Consider reducing size of fixed elements on mobile');
      }
    }
  });
  
  return {
    valid: issues.length === 0,
    issues,
    suggestions,
    score: Math.max(0, 100 - (issues.length * 10))
  };
}

/**
 * Optimizes images for mobile devices
 */
export function optimizeImagesForMobile(container: Document | HTMLElement = document): void {
  if (typeof window === 'undefined') return;
  
  const images = container.querySelectorAll('img');

  images.forEach((img: HTMLImageElement) => {
    // Add responsive attributes if missing
    if (!img.hasAttribute('loading')) {
      img.loading = 'lazy';
    }
    
    if (!img.hasAttribute('decoding')) {
      img.decoding = 'async';
    }
    
    // Ensure images are responsive
    if (!img.style.maxWidth && !img.classList.contains('responsive')) {
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    }
    
    // Add proper alt text if missing
    if (!img.alt && img.dataset.alt) {
      img.alt = img.dataset.alt;
    }
  });
}

/**
 * Checks for mobile-specific performance issues
 */
export function checkMobilePerformance(): PerformanceResult {
  if (typeof window === 'undefined') return { issues: [], suggestions: [], score: 100 };

  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check for large images
  const images = document.querySelectorAll('img');
  images.forEach((img: HTMLImageElement) => {
    if (img.naturalWidth > 1200 || img.naturalHeight > 1200) {
      issues.push(`Large image detected: ${img.src} (${img.naturalWidth}x${img.naturalHeight})`);
      suggestions.push('Use responsive images with appropriate sizes for mobile');
    }
  });
  
  // Check for excessive DOM nodes
  const allElements = document.querySelectorAll('*');
  if (allElements.length > 1500) {
    issues.push(`High DOM complexity: ${allElements.length} elements`);
    suggestions.push('Reduce DOM complexity for better mobile performance');
  }
  
  // Check for blocking resources
  const scripts = document.querySelectorAll('script[src]');
  scripts.forEach((script: HTMLScriptElement) => {
    if (!script.async && !script.defer && !script.type) {
      issues.push(`Blocking script detected: ${script.src}`);
      suggestions.push('Add async or defer attributes to non-critical scripts');
    }
  });
  
  // Check for large stylesheets
  const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
  if (stylesheets.length > 5) {
    issues.push(`Multiple stylesheets detected: ${stylesheets.length}`);
    suggestions.push('Consider combining CSS files to reduce requests');
  }
  
  return {
    issues,
    suggestions,
    score: Math.max(0, 100 - (issues.length * 15))
  };
}

/**
 * Implements mobile-specific optimizations
 */
export function implementMobileOptimizations(): void {
  if (typeof window === 'undefined') return;
  
  // Add touch-friendly classes
  document.body.classList.add('touch-optimized');
  
  // Optimize scroll behavior - only for specific elements, not global navigation
  // Global smooth scrolling can interfere with page navigation scroll restoration
  // Instead, apply smooth scrolling only to specific scroll containers
  const scrollContainers = document.querySelectorAll('.smooth-scroll, .carousel, .scroll-container');
  scrollContainers.forEach((container: Element) => {
    const htmlContainer = container as HTMLElement;
    if ('scrollBehavior' in htmlContainer.style) {
      htmlContainer.style.scrollBehavior = 'smooth';
    }
  });
  
  // Add mobile-specific event listeners
  let touchStartY = 0;
  let touchEndY = 0;

  document.addEventListener('touchstart', (e: TouchEvent) => {
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e: TouchEvent) => {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });

  function handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = touchStartY - touchEndY;
    
    if (Math.abs(diff) > swipeThreshold) {
      // Track swipe gestures for analytics
      if (window.gtag) {
        window.gtag('event', 'mobile_swipe', {
          event_category: 'Mobile Interaction',
          event_label: diff > 0 ? 'swipe_up' : 'swipe_down'
        });
      }
    }
  }
  
  // Optimize form inputs for mobile
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((input: Element) => {
    const htmlInput = input as HTMLInputElement;
    // Add appropriate input modes
    if (htmlInput.type === 'email' && !htmlInput.inputMode) {
      htmlInput.inputMode = 'email';
    }
    if (htmlInput.type === 'tel' && !htmlInput.inputMode) {
      htmlInput.inputMode = 'tel';
    }
    if (htmlInput.type === 'number' && !htmlInput.inputMode) {
      htmlInput.inputMode = 'numeric';
    }

    // Prevent zoom on focus for iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      const fontSize = window.getComputedStyle(htmlInput).fontSize;
      if (parseFloat(fontSize) < 16) {
        htmlInput.style.fontSize = '16px';
      }
    }
  });
}

/**
 * Checks if device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
}

/**
 * Gets mobile-specific recommendations
 */
export function getMobileRecommendations(): string[] {
  const recommendations: string[] = [];
  
  if (isMobileDevice()) {
    const validation = validateMobileFriendly();
    const performance = checkMobilePerformance();
    
    recommendations.push(...validation.suggestions);
    recommendations.push(...performance.suggestions);
    
    // Add general mobile recommendations
    recommendations.push(
      'Use responsive design with flexible layouts',
      'Optimize images for different screen densities',
      'Minimize the use of pop-ups and overlays',
      'Ensure fast loading times (under 3 seconds)',
      'Use large, touch-friendly buttons and links',
      'Implement proper error handling for network issues',
      'Consider offline functionality with service workers'
    );
  }
  
  return [...new Set(recommendations)]; // Remove duplicates
}

/**
 * Monitors mobile performance metrics
 */
export function monitorMobileMetrics(): void {
  if (typeof window === 'undefined' || !isMobileDevice()) return;
  
  // Monitor network conditions
  if ('connection' in navigator) {
    const connection = navigator.connection!;
    
    if (window.gtag) {
      window.gtag('event', 'mobile_network', {
        event_category: 'Mobile Performance',
        connection_type: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      });
    }
  }
  
  // Monitor device orientation changes
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (window.gtag) {
        window.gtag('event', 'orientation_change', {
          event_category: 'Mobile Interaction',
          orientation: window.orientation
        });
      }
    }, 100);
  });
  
  // Monitor touch interactions
  let touchCount = 0;
  document.addEventListener('touchstart', (): void => {
    touchCount++;

    // Report touch interaction frequency
    if (touchCount % 10 === 0 && window.gtag) {
      window.gtag('event', 'touch_interactions', {
        event_category: 'Mobile Interaction',
        value: touchCount
      });
    }
  }, { passive: true });
}