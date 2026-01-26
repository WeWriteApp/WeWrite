"use client";

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { BRAND_COLORS } from './constants';

/**
 * Sample Remotion Composition - Hello World
 *
 * This is a basic example showing text animation
 */
export const HelloWorld: React.FC<{
  titleText?: string;
  titleColor?: string;
  orientation?: 'horizontal' | 'vertical';
}> = ({ titleText = 'Welcome to WeWrite', titleColor = BRAND_COLORS.primary, orientation = 'horizontal' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isVertical = orientation === 'vertical';

  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Scale animation
  const scale = interpolate(frame, [0, 30], [0.8, 1], {
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
      {/* Gradient background blobs */}
      <div
        style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
          filter: 'blur(80px)',
          top: '-200px',
          left: '-200px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
          filter: 'blur(80px)',
          bottom: '-300px',
          right: '-300px',
        }}
      />

      {/* Main content */}
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
          padding: isVertical ? '0 60px' : '0 100px',
        }}
      >
        <h1
          style={{
            fontSize: isVertical ? '90px' : '120px',
            fontWeight: 800,
            color: titleColor,
            margin: 0,
            marginBottom: isVertical ? '30px' : '40px',
            textShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            lineHeight: 1.1,
          }}
        >
          {titleText}
        </h1>
        <p
          style={{
            fontSize: isVertical ? '38px' : '48px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.85)',
            margin: 0,
          }}
        >
          Create stunning marketing videos
        </p>
      </div>
    </AbsoluteFill>
  );
};
