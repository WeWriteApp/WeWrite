"use client";

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { BRAND_COLORS } from './constants';
import { AnimatedBlobs, WeWriteLogo } from './SharedComponents';

/**
 * Landing Page Hero - Main marketing pitch
 */
export const LandingPageHero: React.FC<{
  orientation?: 'horizontal' | 'vertical';
}> = ({ orientation = 'horizontal' }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = orientation === 'vertical';

  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Scale animation for title
  const titleScale = interpolate(frame, [0, 40], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtitle slide up
  const subtitleY = interpolate(frame, [30, 50], [50, 0], {
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Animated gradient background blobs - 3 blobs for landing page */}
      <AnimatedBlobs
        colors={[BRAND_COLORS.primary, BRAND_COLORS.purple, BRAND_COLORS.green]}
        positions={[
          { top: '-300px', left: '-200px' },
          { top: '50%', right: '-250px' },
          { bottom: '-200px', left: '30%' }
        ]}
      />

      {/* WeWrite Logo */}
      <WeWriteLogo isVertical={isVertical} />

      {/* Main content */}
      <div
        style={{
          opacity,
          textAlign: 'center',
          padding: isVertical ? '0 60px' : '0 120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: isVertical ? '100%' : '85%',
        }}
      >
        <h1
          style={{
            fontSize: isVertical ? '140px' : '180px',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            marginBottom: isVertical ? '40px' : '50px',
            textShadow: `0 4px 20px ${BRAND_COLORS.primary}80`,
            lineHeight: 1.1,
            transform: `scale(${titleScale})`,
          }}
        >
          WeWrite
        </h1>
        <p
          style={{
            fontSize: isVertical ? '56px' : '72px',
            fontWeight: 600,
            background: `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.purple})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            lineHeight: 1.3,
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
          }}
        >
          Write. Share. Earn.
        </p>
      </div>
    </AbsoluteFill>
  );
};
