"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '../../lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  fill?: boolean;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  // Performance optimizations
  lowQualityPlaceholder?: boolean;
  adaptiveLoading?: boolean;
  networkAware?: boolean;
}

/**
 * OptimizedImage - High-performance image component for poor network connections
 * 
 * Features:
 * - Automatic WebP/AVIF format selection
 * - Adaptive quality based on network conditions
 * - Low-quality placeholder (LQIP) support
 * - Intersection Observer lazy loading
 * - Network-aware loading strategies
 * - Graceful fallback handling
 * - Responsive image sizing
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  fill = false,
  loading = 'lazy',
  onLoad,
  onError,
  fallbackSrc,
  lowQualityPlaceholder = true,
  adaptiveLoading = true,
  networkAware = true}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<'slow' | 'fast'>('fast');
  const imgRef = useRef<HTMLImageElement>(null);

  // Network quality detection (client-side only)
  useEffect(() => {
    if (!networkAware || typeof window === 'undefined') return;

    // Check for Network Information API
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      const updateNetworkQuality = () => {
        const effectiveType = connection.effectiveType;
        const isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';
        setNetworkQuality(isSlowConnection ? 'slow' : 'fast');
      };

      updateNetworkQuality();
      connection.addEventListener('change', updateNetworkQuality);

      return () => {
        connection.removeEventListener('change', updateNetworkQuality);
      };
    }
  }, [networkAware]);

  // Adaptive quality based on network conditions
  const getAdaptiveQuality = (): number => {
    if (!adaptiveLoading) return quality || 75;
    
    if (networkQuality === 'slow') {
      return quality ? Math.min(quality, 60) : 50; // Lower quality for slow connections
    }
    
    return quality || 75;
  };

  // Generate responsive sizes if not provided
  const getResponsiveSizes = (): string => {
    if (sizes) return sizes;
    
    if (fill) {
      return '100vw';
    }
    
    if (width && height) {
      return `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, ${width}px`;
    }
    
    return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
  };

  // Generate low-quality placeholder (client-side only)
  const getLowQualityPlaceholder = (): string => {
    if (!lowQualityPlaceholder || blurDataURL) return blurDataURL || '';

    if (typeof window === 'undefined') return '';

    // Generate a simple blur placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, 10, 10);
    }
    return canvas.toDataURL();
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  // Fallback image component
  if (imageError && fallbackSrc) {
    return (
      <OptimizedImage
        {...{
          src: fallbackSrc,
          alt,
          width,
          height,
          className,
          priority,
          quality,
          placeholder,
          sizes,
          fill,
          loading,
          onLoad,
          onError,
          lowQualityPlaceholder: false, // Prevent infinite fallback
          adaptiveLoading: false,
          networkAware: false}}
      />
    );
  }

  // Error state
  if (imageError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400 text-sm',
          className
        )}
        style={{ width, height }}
      >
        <span>Image unavailable</span>
      </div>
    );
  }

  const imageProps = {
    src,
    alt,
    quality: getAdaptiveQuality(),
    sizes: getResponsiveSizes(),
    loading: priority ? 'eager' as const : loading,
    onLoad: handleLoad,
    onError: handleError,
    className: cn(
      'transition-opacity duration-300',
      isLoaded ? 'opacity-100' : 'opacity-0',
      className
    ),
    ...(width && height && !fill ? { width, height } : {}),
    ...(fill ? { fill: true } : {}),
    ...(placeholder === 'blur' ? {
      placeholder: 'blur' as const,
      blurDataURL: blurDataURL || getLowQualityPlaceholder()} : {})};

  return (
    <div className={cn('relative overflow-hidden', !fill && 'inline-block')}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div
          className={cn(
            'absolute inset-0 bg-gray-100 animate-pulse',
            fill ? 'w-full h-full' : ''
          )}
          style={!fill ? { width, height } : {}}
        />
      )}
      
      {/* Optimized Next.js Image */}
      <Image
        {...imageProps}
        priority={priority}
        ref={imgRef}
      />
      
      {/* Network quality indicator (development only) */}
      {process.env.NODE_ENV === 'development' && networkAware && (
        <div className="absolute top-1 right-1 text-xs bg-black/50 text-white px-1 rounded">
          {networkQuality}
        </div>
      )}
    </div>
  );
}

/**
 * Preload critical images for better performance
 */
export function preloadImage(src: string, priority: 'high' | 'low' = 'low') {
  if (typeof window === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.fetchPriority = priority;
  
  document.head.appendChild(link);
}

/**
 * Hook for managing image preloading
 */
export function useImagePreloader() {
  const preloadedImages = useRef(new Set<string>());
  
  const preload = (src: string, priority: 'high' | 'low' = 'low') => {
    if (preloadedImages.current.has(src)) return;
    
    preloadedImages.current.add(src);
    preloadImage(src, priority);
  };
  
  return { preload };
}

export default OptimizedImage;