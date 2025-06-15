"use client";

/**
 * SEO Performance optimization utilities
 * These utilities help improve Core Web Vitals and SEO performance
 */

interface Resource {
  url: string;
  type?: string;
}

interface ImageOptimizationOptions {
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
}

interface ScriptConfig {
  src: string;
  defer?: boolean;
  async?: boolean;
  priority?: 'high' | 'low';
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Preloads critical resources for better performance
 */
export function preloadCriticalResources(resources: Resource[] = []): void {
  if (typeof window === 'undefined') return;
  
  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.url;
    link.as = resource.type || 'fetch';
    
    if (resource.type === 'font') {
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  });
}

/**
 * Lazy loads images with intersection observer for better performance
 */
export function setupLazyLoading(selector: string = 'img[data-src]'): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  
  const images = document.querySelectorAll(selector);
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });
  
  images.forEach(img => imageObserver.observe(img));
}

/**
 * Optimizes font loading for better performance
 */
export function optimizeFontLoading(): void {
  if (typeof window === 'undefined') return;
  
  // Preload critical fonts
  const criticalFonts = [
    '/fonts/inter-var.woff2',
    '/fonts/inter-regular.woff2'
  ];
  
  criticalFonts.forEach(fontUrl => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = fontUrl;
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Implements critical CSS inlining for above-the-fold content
 */
export function inlineCriticalCSS(criticalCSS: string): void {
  if (typeof window === 'undefined' || !criticalCSS) return;
  
  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
}

/**
 * Prefetches next page resources based on user behavior
 */
export function prefetchNextPages(urls: string[] = []): void {
  if (typeof window === 'undefined') return;
  
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Optimizes images for better performance and SEO
 */
export function optimizeImage(img: HTMLImageElement, options: ImageOptimizationOptions = {}): void {
  if (!img || typeof window === 'undefined') return;
  
  const {
    loading = 'lazy',
    decoding = 'async',
    fetchPriority = 'auto'
  } = options;
  
  img.loading = loading;
  img.decoding = decoding;

  if ('fetchPriority' in img) {
    (img as any).fetchPriority = fetchPriority;
  }
  
  // Add proper alt text if missing
  if (!img.alt && img.dataset.alt) {
    img.alt = img.dataset.alt;
  }
}

/**
 * Measures and reports Core Web Vitals
 */
export function measureCoreWebVitals(): void {
  if (typeof window === 'undefined') return;
  
  // Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        // Report LCP to analytics
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            name: 'LCP',
            value: Math.round(lastEntry.startTime),
            event_category: 'Web Vitals'
          });
        }
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('LCP measurement failed:', error);
    }
    
    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          // Report FID to analytics
          if (window.gtag) {
            window.gtag('event', 'web_vitals', {
              name: 'FID',
              value: Math.round(entry.processingStart - entry.startTime),
              event_category: 'Web Vitals'
            });
          }
        });
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      console.warn('FID measurement failed:', error);
    }
    
    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        
        // Report CLS to analytics
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            name: 'CLS',
            value: Math.round(clsValue * 1000),
            event_category: 'Web Vitals'
          });
        }
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('CLS measurement failed:', error);
    }
  }
}

/**
 * Optimizes third-party scripts for better performance
 */
export function optimizeThirdPartyScripts(scripts: ScriptConfig[] = []): void {
  if (typeof window === 'undefined') return;
  
  scripts.forEach(scriptConfig => {
    const script = document.createElement('script');
    
    // Set loading strategy
    if (scriptConfig.defer) {
      script.defer = true;
    } else if (scriptConfig.async) {
      script.async = true;
    }
    
    script.src = scriptConfig.src;
    
    // Add to document
    if (scriptConfig.priority === 'high') {
      document.head.appendChild(script);
    } else {
      document.body.appendChild(script);
    }
  });
}

/**
 * Implements service worker for caching and performance
 */
export function setupServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
