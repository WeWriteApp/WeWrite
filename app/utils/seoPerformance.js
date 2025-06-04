"use client";

/**
 * SEO Performance optimization utilities
 * These utilities help improve Core Web Vitals and SEO performance
 */

/**
 * Preloads critical resources for better performance
 * 
 * @param {Array} resources - Array of resource objects with url and type
 */
export function preloadCriticalResources(resources = []) {
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
 * 
 * @param {string} selector - CSS selector for images to lazy load
 */
export function setupLazyLoading(selector = 'img[data-src]') {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  
  const images = document.querySelectorAll(selector);
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
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
export function optimizeFontLoading() {
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
 * 
 * @param {string} criticalCSS - Critical CSS string
 */
export function inlineCriticalCSS(criticalCSS) {
  if (typeof window === 'undefined' || !criticalCSS) return;
  
  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
}

/**
 * Prefetches next page resources based on user behavior
 * 
 * @param {Array} urls - URLs to prefetch
 */
export function prefetchNextPages(urls = []) {
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
 * 
 * @param {HTMLImageElement} img - Image element to optimize
 * @param {Object} options - Optimization options
 */
export function optimizeImage(img, options = {}) {
  if (!img || typeof window === 'undefined') return;
  
  const {
    loading = 'lazy',
    decoding = 'async',
    fetchPriority = 'auto'
  } = options;
  
  img.loading = loading;
  img.decoding = decoding;
  
  if ('fetchPriority' in img) {
    img.fetchPriority = fetchPriority;
  }
  
  // Add proper alt text if missing
  if (!img.alt && img.dataset.alt) {
    img.alt = img.dataset.alt;
  }
}

/**
 * Measures and reports Core Web Vitals
 */
export function measureCoreWebVitals() {
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
 * 
 * @param {Array} scripts - Array of script configurations
 */
export function optimizeThirdPartyScripts(scripts = []) {
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
export function setupServiceWorker() {
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
