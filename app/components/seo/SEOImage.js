"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';

/**
 * SEO-optimized Image component with automatic optimization
 * 
 * @param {Object} props - Component props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Alt text for accessibility and SEO
 * @param {number} props.width - Image width
 * @param {number} props.height - Image height
 * @param {string} props.title - Image title attribute
 * @param {string} props.caption - Image caption for schema markup
 * @param {string} props.priority - Loading priority (high, low, auto)
 * @param {boolean} props.enableSchema - Whether to add image schema markup
 * @param {Object} props.schemaData - Additional schema data
 * @param {string} props.className - CSS class name
 * @param {Object} props.style - Inline styles
 */
export function SEOImage({
  src,
  alt,
  width,
  height,
  title,
  caption,
  priority = 'auto',
  enableSchema = false,
  schemaData = {},
  className = '',
  style = {},
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Generate optimized alt text if not provided
  const optimizedAlt = alt || generateAltText(src, caption);

  // Determine loading strategy
  const loadingPriority = priority === 'high' ? true : false;
  const loading = priority === 'high' ? 'eager' : 'lazy';

  useEffect(() => {
    if (enableSchema && src && optimizedAlt) {
      // Add image schema markup
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        url: src,
        name: title || optimizedAlt,
        description: caption || optimizedAlt,
        width: width,
        height: height,
        ...schemaData
      };

      const scriptId = `image-schema-${src.replace(/[^a-zA-Z0-9]/g, '')}`;
      let script = document.getElementById(scriptId);
      
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      }

      return () => {
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
          document.head.removeChild(existingScript);
        }
      };
    }
  }, [enableSchema, src, optimizedAlt, title, caption, width, height, schemaData]);

  const handleLoad = () => {
    setIsLoaded(true);
    
    // Track image load performance
    if (window.gtag) {
      window.gtag('event', 'image_loaded', {
        event_category: 'SEO Performance',
        event_label: src,
        loading_priority: priority
      });
    }
  };

  const handleError = () => {
    setHasError(true);
    
    // Track image load errors
    if (window.gtag) {
      window.gtag('event', 'image_error', {
        event_category: 'SEO Performance',
        event_label: src
      });
    }
  };

  if (hasError) {
    return (
      <div 
        className={`seo-image-error ${className}`}
        style={{
          width: width || '100%',
          height: height || 'auto',
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '14px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          ...style
        }}
        role="img"
        aria-label={optimizedAlt}
      >
        🖼️ Image unavailable
      </div>
    );
  }

  return (
    <figure className={`seo-image-container ${className}`} style={style}>
      <Image
        src={src}
        alt={optimizedAlt}
        width={width}
        height={height}
        title={title}
        priority={loadingPriority}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          opacity: isLoaded ? 1 : 0.7,
          transition: 'opacity 0.3s ease',
          ...props.style
        }}
        {...props}
      />
      
      {caption && (
        <figcaption style={{
          fontSize: '14px',
          color: '#666',
          marginTop: '8px',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Responsive SEO Image component with multiple sizes
 */
export function ResponsiveSEOImage({
  src,
  alt,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  width = 800,
  height = 600,
  ...props
}) {
  return (
    <SEOImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      style={{
        width: '100%',
        height: 'auto'
      }}
      {...props}
    />
  );
}

/**
 * Hero Image component optimized for above-the-fold content
 */
export function HeroSEOImage({
  src,
  alt,
  width = 1200,
  height = 630,
  overlay = false,
  overlayColor = 'rgba(0, 0, 0, 0.4)',
  children,
  ...props
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: 'auto' }}>
      <SEOImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority="high"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block'
        }}
        {...props}
      />
      
      {overlay && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: overlayColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Gallery Image component with lazy loading
 */
export function GallerySEOImage({
  src,
  alt,
  thumbnail,
  width = 400,
  height = 300,
  onClick,
  ...props
}) {
  const [showFullSize, setShowFullSize] = useState(false);

  const handleClick = () => {
    setShowFullSize(true);
    if (onClick) onClick();
  };

  return (
    <>
      <SEOImage
        src={thumbnail || src}
        alt={alt}
        width={width}
        height={height}
        priority="low"
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          borderRadius: '8px',
          transition: 'transform 0.2s ease',
          ...props.style
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
        {...props}
      />
      
      {showFullSize && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowFullSize(false)}
        >
          <SEOImage
            src={src}
            alt={alt}
            width={width * 2}
            height={height * 2}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
          />
        </div>
      )}
    </>
  );
}

/**
 * Avatar Image component for user profiles
 */
export function AvatarSEOImage({
  src,
  alt,
  size = 64,
  fallbackText,
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          fontWeight: 'bold',
          color: '#666'
        }}
        role="img"
        aria-label={alt}
      >
        {fallbackText ? fallbackText.charAt(0).toUpperCase() : '👤'}
      </div>
    );
  }

  return (
    <SEOImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setHasError(true)}
      style={{
        borderRadius: '50%',
        objectFit: 'cover'
      }}
      {...props}
    />
  );
}

/**
 * Utility function to generate alt text from image URL and context
 */
function generateAltText(src, caption) {
  if (caption) return caption;
  
  // Extract filename and clean it up
  const filename = src.split('/').pop().split('.')[0];
  const cleaned = filename
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  
  return `Image: ${cleaned}`;
}

/**
 * Image optimization utility
 */
export function optimizeImageForSEO(imageElement) {
  if (!imageElement) return;

  // Add loading attribute if missing
  if (!imageElement.hasAttribute('loading')) {
    imageElement.loading = 'lazy';
  }

  // Add decoding attribute if missing
  if (!imageElement.hasAttribute('decoding')) {
    imageElement.decoding = 'async';
  }

  // Ensure alt text exists
  if (!imageElement.alt) {
    const src = imageElement.src || imageElement.dataset.src;
    if (src) {
      imageElement.alt = generateAltText(src);
    }
  }

  // Add responsive behavior if missing
  if (!imageElement.style.maxWidth) {
    imageElement.style.maxWidth = '100%';
    imageElement.style.height = 'auto';
  }
}
