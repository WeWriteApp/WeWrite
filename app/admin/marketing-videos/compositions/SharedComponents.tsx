"use client";

import { useCurrentFrame, interpolate } from 'remotion';
import { BRAND_COLORS } from './constants';

/**
 * Animated Background Blobs
 * Blobs that move around smoothly throughout the video
 */
export const AnimatedBlobs: React.FC<{
  colors: string[];
  positions?: Array<{ top?: string; bottom?: string; left?: string; right?: string }>;
}> = ({ colors, positions }) => {
  const frame = useCurrentFrame();

  // Smooth circular motion for blobs with different speeds
  const blob1X = interpolate(frame, [0, 150], [0, 100], {
    extrapolateRight: 'wrap',
  });
  const blob1Y = interpolate(frame, [0, 150], [0, 80], {
    extrapolateRight: 'wrap',
  });

  const blob2X = interpolate(frame, [0, 150], [0, -120], {
    extrapolateRight: 'wrap',
  });
  const blob2Y = interpolate(frame, [0, 150], [0, -60], {
    extrapolateRight: 'wrap',
  });

  const blob3X = interpolate(frame, [0, 150], [0, 70], {
    extrapolateRight: 'wrap',
  });
  const blob3Y = interpolate(frame, [0, 150], [0, -90], {
    extrapolateRight: 'wrap',
  });

  const defaultPositions = [
    { top: '-200px', left: '-200px' },
    { bottom: '-300px', right: '-300px' },
  ];

  const blobPositions = positions || defaultPositions;
  const blobMovements = [
    { x: blob1X, y: blob1Y },
    { x: blob2X, y: blob2Y },
    { x: blob3X, y: blob3Y },
  ];

  return (
    <>
      {colors.map((color, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            width: index === 0 ? '800px' : index === 1 ? '900px' : '700px',
            height: index === 0 ? '800px' : index === 1 ? '900px' : '700px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}${index === 0 ? '66' : index === 1 ? '4D' : '33'} 0%, transparent 70%)`,
            filter: 'blur(80px)',
            ...(blobPositions[index] || {}),
            transform: `translate(${blobMovements[index]?.x || 0}px, ${blobMovements[index]?.y || 0}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
      ))}
    </>
  );
};

/**
 * WeWrite Logo
 * Displays in the bottom left corner
 */
export const WeWriteLogo: React.FC<{ isVertical?: boolean }> = ({ isVertical = false }) => {
  const frame = useCurrentFrame();

  // Fade in logo
  const logoOpacity = interpolate(frame, [0, 20], [0, 0.7], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isVertical ? '40px' : '50px',
        left: isVertical ? '40px' : '60px',
        opacity: logoOpacity,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          fontSize: isVertical ? '28px' : '36px',
          fontWeight: 800,
          color: 'white',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          letterSpacing: '-0.5px',
        }}
      >
        WeWrite
      </div>
    </div>
  );
};

/**
 * 3D Device Frame
 * iPhone-style device mockup for showcasing UI
 */
export const Device3D: React.FC<{
  isVertical?: boolean;
  children?: React.ReactNode;
  frame?: number;
}> = ({ isVertical = false, children, frame = 0 }) => {
  const currentFrame = useCurrentFrame();
  const f = frame || currentFrame;

  // Device entrance animation
  const deviceY = interpolate(f, [0, 30], [100, 0], {
    extrapolateRight: 'clamp',
  });

  const deviceOpacity = interpolate(f, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // 3D tilt effect
  const tilt = interpolate(f, [30, 60, 90, 120], [0, -5, 0, -5], {
    extrapolateRight: 'clamp',
  });

  const deviceWidth = isVertical ? 320 : 380;
  const deviceHeight = isVertical ? 600 : 700;

  return (
    <div
      style={{
        opacity: deviceOpacity,
        transform: `translateY(${deviceY}px) perspective(1000px) rotateY(${tilt}deg)`,
        position: 'relative',
      }}
    >
      {/* Device frame */}
      <div
        style={{
          width: `${deviceWidth}px`,
          height: `${deviceHeight}px`,
          background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
          borderRadius: '50px',
          padding: '16px',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.5)',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '30px',
            background: '#000',
            borderBottomLeftRadius: '20px',
            borderBottomRightRadius: '20px',
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#000',
            borderRadius: '40px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
