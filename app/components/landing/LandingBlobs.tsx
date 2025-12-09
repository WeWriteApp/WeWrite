"use client";

import React, { useState, useEffect } from 'react';
import { useLandingColors } from './LandingColorContext';

/**
 * LandingBlobs - Animated gradient blobs for the landing page background.
 * Uses LandingColorContext for colors, not global CSS variables.
 */

// Animation keyframes are defined in CSS, but colors are applied via inline styles
const blobAnimations = {
  blob1: 'blob-float-1 12s ease-in-out infinite',
  blob2: 'blob-float-2 15s ease-in-out infinite',
  blob3: 'blob-float-3 10s ease-in-out infinite',
  blob4: 'blob-float-4 18s ease-in-out infinite',
};

export function LandingBlobs() {
  const colors = useLandingColors();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport for enhanced visibility
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile gets higher opacity and less blur for better visibility
  const mobileOpacityBoost = isMobile ? 0.15 : 0;
  const blurAmount = isMobile
    ? (colors.isDark ? '60px' : '50px')
    : (colors.isDark ? '100px' : '80px');

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    filter: `blur(${blurAmount})`,
    willChange: 'transform',
    background: colors.blobColor,
    transition: 'background 0.3s ease-out',
  };

  return (
    <div
      className="landing-blobs-container"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {/* Blob 1 - Top left, largest */}
      <div
        style={{
          ...baseStyle,
          width: isMobile ? '80vw' : '60vw',
          height: isMobile ? '80vw' : '60vw',
          maxWidth: '800px',
          maxHeight: '800px',
          top: isMobile ? '-10%' : '-20%',
          left: isMobile ? '-20%' : '-15%',
          opacity: (colors.isDark ? 0.25 : 0.35) + mobileOpacityBoost,
          animation: blobAnimations.blob1,
        }}
      />

      {/* Blob 2 - Bottom right */}
      <div
        style={{
          ...baseStyle,
          width: isMobile ? '70vw' : '50vw',
          height: isMobile ? '70vw' : '50vw',
          maxWidth: '700px',
          maxHeight: '700px',
          bottom: isMobile ? '0%' : '-10%',
          right: isMobile ? '-15%' : '-10%',
          opacity: (colors.isDark ? 0.25 : 0.35) + mobileOpacityBoost,
          animation: blobAnimations.blob2,
          animationDelay: '-5s',
        }}
      />

      {/* Blob 3 - Center, smaller accent */}
      <div
        style={{
          ...baseStyle,
          width: isMobile ? '60vw' : '40vw',
          height: isMobile ? '60vw' : '40vw',
          maxWidth: '500px',
          maxHeight: '500px',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: (colors.isDark ? 0.18 : 0.25) + mobileOpacityBoost,
          animation: blobAnimations.blob3,
          animationDelay: '-3s',
        }}
      />

      {/* Blob 4 - Bottom left accent */}
      <div
        style={{
          ...baseStyle,
          width: isMobile ? '50vw' : '35vw',
          height: isMobile ? '50vw' : '35vw',
          maxWidth: '450px',
          maxHeight: '450px',
          bottom: isMobile ? '30%' : '20%',
          left: isMobile ? '-10%' : '-5%',
          opacity: (colors.isDark ? 0.20 : 0.28) + mobileOpacityBoost,
          animation: blobAnimations.blob4,
          animationDelay: '-8s',
        }}
      />
    </div>
  );
}

export default LandingBlobs;
