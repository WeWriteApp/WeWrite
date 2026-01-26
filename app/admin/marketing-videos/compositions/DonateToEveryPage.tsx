"use client";

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { BRAND_COLORS } from './constants';
import { AnimatedBlobs, WeWriteLogo, Device3D } from './SharedComponents';

/**
 * Donate to Every Page - Feature Showcase with 3D Device Preview
 */
export const DonateToEveryPage: React.FC<{
  orientation?: 'horizontal' | 'vertical';
}> = ({ orientation = 'horizontal' }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = orientation === 'vertical';

  // Title fade in animation
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title scale animation
  const titleScale = interpolate(frame, [0, 30], [0.9, 1], {
    extrapolateRight: 'clamp',
  });

  // Allocation bar tap animation
  const barProgress = interpolate(frame, [60, 90], [0, 80], {
    extrapolateRight: 'clamp',
  });

  // Finger tap animation
  const fingerOpacity = interpolate(frame, [60, 70, 80, 90], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  const fingerScale = interpolate(frame, [70, 75], [1, 0.9], {
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
      <AnimatedBlobs colors={[BRAND_COLORS.primary, BRAND_COLORS.green]} />

      {/* WeWrite Logo */}
      <WeWriteLogo isVertical={isVertical} />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isVertical ? '60px' : '100px',
          padding: isVertical ? '0 40px' : '0 80px',
          width: '100%',
        }}
      >
        {/* Text content */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            textAlign: isVertical ? 'center' : 'left',
            maxWidth: isVertical ? '100%' : '500px',
          }}
        >
          <h1
            style={{
              fontSize: isVertical ? '110px' : '130px',
              fontWeight: 800,
              color: BRAND_COLORS.primary,
              margin: 0,
              marginBottom: isVertical ? '35px' : '40px',
              textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              lineHeight: 1.1,
            }}
          >
            Donate to Every Page
          </h1>
          <p
            style={{
              fontSize: isVertical ? '48px' : '56px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Support writers directly with flexible micro-donations
          </p>
        </div>

        {/* 3D Device with Allocation Bar */}
        <Device3D isVertical={isVertical} frame={frame}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '60px 40px',
              position: 'relative',
            }}
          >
            {/* Page Title */}
            <div
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '40px',
                textAlign: 'center',
              }}
            >
              Amazing Article
            </div>

            {/* Author Avatar & Name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '50px',
                paddingLeft: '20px',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: BRAND_COLORS.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}
              >
                ✍️
              </div>
              <div
                style={{
                  fontSize: '20px',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                Writer Name
              </div>
            </div>

            {/* Allocation Bar Container */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '20px',
                padding: '30px',
                position: 'relative',
              }}
            >
              {/* Label */}
              <div
                style={{
                  fontSize: '16px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                Support this writer
              </div>

              {/* Allocation Bar Track */}
              <div
                style={{
                  width: '100%',
                  height: '50px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '25px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Progress Fill */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${barProgress}%`,
                    background: `linear-gradient(90deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.green})`,
                    borderRadius: '25px',
                    transition: 'width 0.3s ease-out',
                  }}
                />

                {/* Amount Text */}
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#fff',
                    zIndex: 1,
                  }}
                >
                  ${(barProgress * 0.1).toFixed(2)}
                </div>
              </div>

              {/* Tap Indicator */}
              <div
                style={{
                  position: 'absolute',
                  right: '60px',
                  top: '50%',
                  transform: `translateY(-50%) scale(${fingerScale})`,
                  opacity: fingerOpacity,
                  fontSize: '60px',
                  pointerEvents: 'none',
                }}
              >
                👆
              </div>
            </div>

            {/* Info Text */}
            <div
              style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '30px',
                textAlign: 'center',
              }}
            >
              Drag to adjust amount
            </div>
          </div>
        </Device3D>
      </div>
    </AbsoluteFill>
  );
};
