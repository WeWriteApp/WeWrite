"use client";

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { BRAND_COLORS } from './constants';
import { AnimatedBlobs, WeWriteLogo } from './SharedComponents';

/**
 * Use Case: Writers - Marketing pitch for content creators
 */
export const UseCaseWriter: React.FC<{
  orientation?: 'horizontal' | 'vertical';
}> = ({ orientation = 'horizontal' }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = orientation === 'vertical';

  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Scale animation
  const scale = interpolate(frame, [0, 30], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  // Feature items fade in sequentially
  const feature1Opacity = interpolate(frame, [50, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const feature2Opacity = interpolate(frame, [60, 70], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const feature3Opacity = interpolate(frame, [70, 80], [0, 1], {
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
      {/* Animated gradient background blobs */}
      <AnimatedBlobs colors={[BRAND_COLORS.primary, BRAND_COLORS.orange]} />

      {/* WeWrite Logo */}
      <WeWriteLogo isVertical={isVertical} />

      {/* Main content */}
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
          padding: isVertical ? '0 60px' : '0 100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: isVertical ? '100%' : '80%',
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: isVertical ? '130px' : '160px',
            marginBottom: isVertical ? '35px' : '45px',
          }}
        >
          ✍️
        </div>

        <h1
          style={{
            fontSize: isVertical ? '100px' : '130px',
            fontWeight: 800,
            color: BRAND_COLORS.primary,
            margin: 0,
            marginBottom: isVertical ? '30px' : '35px',
            textShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            lineHeight: 1.1,
          }}
        >
          For Writers
        </h1>

        {/* Feature list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isVertical ? '20px' : '25px',
            fontSize: isVertical ? '42px' : '52px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <div style={{ opacity: feature1Opacity }}>
            💰 Earn from every page
          </div>
          <div style={{ opacity: feature2Opacity }}>
            📊 Track your audience
          </div>
          <div style={{ opacity: feature3Opacity }}>
            🚀 Build your following
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
