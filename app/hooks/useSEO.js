"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  extractDescription, 
  generateKeywords, 
  generateBreadcrumbs,
  cleanMetaDescription 
} from '../utils/seoUtils';
import { validateHeadingHierarchy } from '../utils/headingHierarchy';
import { validateMobileFriendly } from '../utils/mobileOptimization';

/**
 * Advanced SEO hook for WeWrite pages
 * 
 * @param {Object} options - SEO configuration options
 * @returns {Object} - SEO utilities and state
 */
export function useSEO(options = {}) {
  const router = useRouter();
  const [seoState, setSeoState] = useState({
    isOptimized: false,
    score: 0,
    issues: [],
    recommendations: []
  });

  const {
    title,
    description,
    content,
    author,
    tags = [],
    type = 'webpage',
    enableAutoOptimization = true,
    enablePerformanceTracking = true
  } = options;

  /**
   * Update page meta tags dynamically
   */
  const updateMetaTags = useCallback((metaData) => {
    const { title: newTitle, description: newDescription, canonical, noIndex } = metaData;

    // Update document title
    if (newTitle && typeof document !== 'undefined') {
      document.title = newTitle;
    }

    // Update meta description
    if (newDescription && typeof document !== 'undefined') {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = cleanMetaDescription(newDescription);
    }

    // Update canonical URL
    if (canonical && typeof document !== 'undefined') {
      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonical;
    }

    // Update robots meta
    if (typeof document !== 'undefined') {
      let robotsMeta = document.querySelector('meta[name="robots"]');
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.content = noIndex ? 'noindex,nofollow' : 'index,follow';
    }
  }, []);

  /**
   * Generate optimized meta data
   */
  const generateMetaData = useCallback(() => {
    const optimizedDescription = description || extractDescription(content, 160);
    const keywords = generateKeywords({
      title,
      content,
      tags,
      username: author?.name
    });

    return {
      title: title || 'WeWrite',
      description: optimizedDescription,
      keywords: keywords.join(', '),
      author: author?.name,
      canonical: typeof window !== 'undefined' ? window.location.href : undefined
    };
  }, [title, description, content, tags, author]);

  /**
   * Validate current page SEO
   */
  const validateSEO = useCallback(async () => {
    if (typeof window === 'undefined') return { score: 0, issues: [] };

    const issues = [];
    const recommendations = [];
    let score = 100;

    // Check heading hierarchy
    const headingValidation = validateHeadingHierarchy();
    if (!headingValidation.valid) {
      issues.push(...headingValidation.issues);
      recommendations.push(...headingValidation.suggestions);
      score -= headingValidation.issues.length * 10;
    }

    // Check mobile friendliness
    const mobileValidation = validateMobileFriendly();
    if (!mobileValidation.valid) {
      issues.push(...mobileValidation.issues);
      recommendations.push(...mobileValidation.suggestions);
      score -= mobileValidation.issues.length * 5;
    }

    // Check meta tags
    const metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc || !metaDesc.content) {
      issues.push('Missing meta description');
      recommendations.push('Add a descriptive meta description');
      score -= 15;
    } else if (metaDesc.content.length < 120) {
      issues.push('Meta description too short');
      recommendations.push('Expand meta description to 120-160 characters');
      score -= 10;
    } else if (metaDesc.content.length > 160) {
      issues.push('Meta description too long');
      recommendations.push('Shorten meta description to under 160 characters');
      score -= 10;
    }

    // Check canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      issues.push('Missing canonical URL');
      recommendations.push('Add canonical URL to prevent duplicate content');
      score -= 10;
    }

    // Check images
    const images = document.querySelectorAll('img');
    let imagesWithoutAlt = 0;
    images.forEach(img => {
      if (!img.alt) {
        imagesWithoutAlt++;
      }
    });
    
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} images missing alt text`);
      recommendations.push('Add descriptive alt text to all images');
      score -= imagesWithoutAlt * 5;
    }

    // Check internal links
    const internalLinks = document.querySelectorAll('a[href^="/"], a[href*="wewrite.app"]');
    if (internalLinks.length === 0) {
      issues.push('No internal links found');
      recommendations.push('Add internal links to improve site navigation');
      score -= 10;
    }

    const finalScore = Math.max(0, score);
    
    setSeoState({
      isOptimized: finalScore >= 80,
      score: finalScore,
      issues,
      recommendations
    });

    return { score: finalScore, issues, recommendations };
  }, []);

  /**
   * Track SEO performance
   */
  const trackPerformance = useCallback(() => {
    if (!enablePerformanceTracking || typeof window === 'undefined') return;

    // Track page load performance
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation && window.gtag) {
        window.gtag('event', 'seo_performance', {
          event_category: 'SEO',
          page_load_time: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
          dom_content_loaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
          seo_score: seoState.score
        });
      }
    }

    // Track SEO score
    if (window.gtag && seoState.score > 0) {
      window.gtag('event', 'seo_score', {
        event_category: 'SEO',
        value: seoState.score,
        page_type: type
      });
    }
  }, [enablePerformanceTracking, seoState.score, type]);

  /**
   * Auto-optimize page SEO
   */
  const autoOptimize = useCallback(() => {
    if (!enableAutoOptimization) return;

    const metaData = generateMetaData();
    updateMetaTags(metaData);

    // Add structured data if not present
    if (typeof document !== 'undefined') {
      const existingSchema = document.querySelector('script[type="application/ld+json"]');
      if (!existingSchema && title && description) {
        const schema = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          description: description,
          url: window.location.href,
          isPartOf: {
            '@type': 'WebSite',
            name: 'WeWrite',
            url: process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'
          }
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      }
    }
  }, [enableAutoOptimization, generateMetaData, updateMetaTags, title, description]);

  /**
   * Generate breadcrumbs for current page
   */
  const getBreadcrumbs = useCallback(() => {
    if (typeof window === 'undefined') return [];

    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';

    const breadcrumbs = [
      { name: 'WeWrite', url: baseUrl }
    ];

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Customize breadcrumb names based on route patterns
      let name = segment;
      if (segment === 'user') {
        name = 'Users';
      } else if (segment === 'group') {
        name = 'Groups';
      } else if (title && index === segments.length - 1) {
        name = title;
      }

      breadcrumbs.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        url: `${baseUrl}${currentPath}`
      });
    });

    return breadcrumbs;
  }, [title]);

  // Auto-optimize on mount and when dependencies change
  useEffect(() => {
    autoOptimize();
  }, [autoOptimize]);

  // Validate SEO after optimization
  useEffect(() => {
    const timer = setTimeout(() => {
      validateSEO();
    }, 1000); // Delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, [validateSEO]);

  // Track performance
  useEffect(() => {
    if (seoState.score > 0) {
      trackPerformance();
    }
  }, [seoState.score, trackPerformance]);

  return {
    // State
    seoState,
    
    // Actions
    updateMetaTags,
    validateSEO,
    autoOptimize,
    
    // Utilities
    generateMetaData,
    getBreadcrumbs,
    
    // Computed values
    isOptimized: seoState.isOptimized,
    score: seoState.score,
    issues: seoState.issues,
    recommendations: seoState.recommendations
  };
}
