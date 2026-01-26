"use client";

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { BRAND_COLORS } from './constants';
import { AnimatedBlobs, WeWriteLogo, Device3D } from './SharedComponents';

/**
 * Build Your Graph - Feature Showcase with Real UI Flow
 * Shows: Content page → Scroll down → Graph card appears → Click → Drawer opens with graph
 */
export const BuildYourGraph: React.FC<{
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

  // Content scroll animation (0-40 frames)
  const contentScrollY = interpolate(frame, [0, 40], [0, -180], {
    extrapolateRight: 'clamp',
  });

  // Graph card appears (30-50 frames)
  const cardOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const cardY = interpolate(frame, [30, 50], [30, 0], {
    extrapolateRight: 'clamp',
  });

  // Click indicator (70-80 frames)
  const clickOpacity = interpolate(frame, [70, 75, 85, 90], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  // Drawer slides up (90-110 frames) - relative to device height
  const drawerY = interpolate(frame, [90, 110], [700, 70], {
    extrapolateRight: 'clamp',
  });

  // Graph nodes appear (110-150 frames)
  const node1Opacity = interpolate(frame, [110, 120], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const node2Opacity = interpolate(frame, [120, 130], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const node3Opacity = interpolate(frame, [130, 140], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const node4Opacity = interpolate(frame, [135, 145], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Connection lines
  const line1Opacity = interpolate(frame, [125, 135], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const line2Opacity = interpolate(frame, [135, 145], [0, 1], {
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
      <AnimatedBlobs colors={[BRAND_COLORS.purple, BRAND_COLORS.primary]} />

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
              color: BRAND_COLORS.purple,
              margin: 0,
              marginBottom: isVertical ? '35px' : '40px',
              textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              lineHeight: 1.1,
            }}
          >
            Build Your Graph
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
            Connect ideas and create your knowledge network
          </p>
        </div>

        {/* 3D Device with Graph UI Flow */}
        <Device3D isVertical={isVertical} frame={frame}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Content Page Container */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${contentScrollY}px)`,
                padding: '30px 20px',
              }}
            >
              {/* Article Content */}
              <div style={{ marginBottom: '20px' }}>
                <h1
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: '#fff',
                    margin: 0,
                    marginBottom: '12px',
                    lineHeight: 1.2,
                  }}
                >
                  Knowledge Graphs
                </h1>
                <div
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.5,
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  <p style={{ margin: '0 0 8px 0' }}>
                    Every page becomes part of a living network. Link to other ideas and watch
                    your knowledge graph grow.
                  </p>
                  <p style={{ margin: '0' }}>
                    Discover patterns, make connections, and build a second brain that evolves
                    with you.
                  </p>
                </div>
              </div>

              {/* Graph View Card */}
              <div
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '12px',
                    position: 'relative',
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* Network Icon */}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.5)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2v4" />
                        <path d="M12 18v4" />
                        <path d="M4.93 4.93l2.83 2.83" />
                        <path d="M16.24 16.24l2.83 2.83" />
                        <path d="M2 12h4" />
                        <path d="M18 12h4" />
                        <path d="M4.93 19.07l2.83-2.83" />
                        <path d="M16.24 7.76l2.83-2.83" />
                      </svg>
                      <h3
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#fff',
                          margin: 0,
                        }}
                      >
                        Graph view
                      </h3>
                    </div>
                    <span
                      style={{
                        fontSize: '8px',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      Tap to explore
                    </span>
                  </div>

                  {/* Graph Preview */}
                  <div
                    style={{
                      height: '140px',
                      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Simplified graph preview */}
                    <div style={{ position: 'relative', width: '80%', height: '70%' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: BRAND_COLORS.primary,
                          boxShadow: `0 0 10px ${BRAND_COLORS.primary}80`,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '20%',
                          top: '20%',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: BRAND_COLORS.purple,
                          boxShadow: `0 0 8px ${BRAND_COLORS.purple}80`,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: '20%',
                          top: '30%',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: BRAND_COLORS.green,
                          boxShadow: `0 0 8px ${BRAND_COLORS.green}80`,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '30%',
                          bottom: '25%',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: BRAND_COLORS.orange,
                          boxShadow: `0 0 8px ${BRAND_COLORS.orange}80`,
                        }}
                      />
                      <svg
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        <line
                          x1="50%"
                          y1="50%"
                          x2="20%"
                          y2="20%"
                          stroke="rgba(139, 92, 246, 0.3)"
                          strokeWidth="1"
                        />
                        <line
                          x1="50%"
                          y1="50%"
                          x2="80%"
                          y2="30%"
                          stroke="rgba(34, 197, 94, 0.3)"
                          strokeWidth="1"
                        />
                        <line
                          x1="50%"
                          y1="50%"
                          x2="30%"
                          y2="75%"
                          stroke="rgba(245, 158, 11, 0.3)"
                          strokeWidth="1"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Click indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      opacity: clickOpacity,
                      fontSize: '32px',
                      pointerEvents: 'none',
                    }}
                  >
                    👆
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer with Full Graph */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '90%',
                background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                transform: `translateY(${drawerY}px)`,
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Drawer Header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h3
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#fff',
                    margin: 0,
                  }}
                >
                  Connections
                </h3>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </div>
              </div>

              {/* Interactive Graph */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '30px 20px',
                  position: 'relative',
                }}
              >
                {/* Center Node */}
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: BRAND_COLORS.primary,
                    opacity: node1Opacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 20px ${BRAND_COLORS.primary}80`,
                  }}
                >
                  <div style={{ fontSize: '20px' }}>📄</div>
                  <div
                    style={{
                      fontSize: '7px',
                      color: '#fff',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    Current
                  </div>
                </div>

                {/* Node 2 - Top Right */}
                <div
                  style={{
                    position: 'absolute',
                    right: '15%',
                    top: '20%',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: BRAND_COLORS.purple,
                    opacity: node2Opacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 15px ${BRAND_COLORS.purple}80`,
                  }}
                >
                  <div style={{ fontSize: '18px' }}>🔗</div>
                  <div
                    style={{
                      fontSize: '6px',
                      color: '#fff',
                      fontWeight: 600,
                      marginTop: '1px',
                    }}
                  >
                    Related
                  </div>
                </div>

                {/* Node 3 - Bottom Left */}
                <div
                  style={{
                    position: 'absolute',
                    left: '15%',
                    bottom: '25%',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: BRAND_COLORS.green,
                    opacity: node3Opacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 15px ${BRAND_COLORS.green}80`,
                  }}
                >
                  <div style={{ fontSize: '18px' }}>✨</div>
                  <div
                    style={{
                      fontSize: '6px',
                      color: '#fff',
                      fontWeight: 600,
                      marginTop: '1px',
                    }}
                  >
                    Ref
                  </div>
                </div>

                {/* Node 4 - Top Left */}
                <div
                  style={{
                    position: 'absolute',
                    left: '20%',
                    top: '25%',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: BRAND_COLORS.orange,
                    opacity: node4Opacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 15px ${BRAND_COLORS.orange}80`,
                  }}
                >
                  <div style={{ fontSize: '16px' }}>💡</div>
                  <div
                    style={{
                      fontSize: '6px',
                      color: '#fff',
                      fontWeight: 600,
                      marginTop: '1px',
                    }}
                  >
                    Idea
                  </div>
                </div>

                {/* Connection Lines (SVG) */}
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  <line
                    x1="50%"
                    y1="50%"
                    x2="85%"
                    y2="20%"
                    stroke={BRAND_COLORS.purple}
                    strokeWidth="1.5"
                    opacity={line1Opacity}
                  />
                  <line
                    x1="50%"
                    y1="50%"
                    x2="15%"
                    y2="75%"
                    stroke={BRAND_COLORS.green}
                    strokeWidth="1.5"
                    opacity={line1Opacity}
                  />
                  <line
                    x1="50%"
                    y1="50%"
                    x2="20%"
                    y2="25%"
                    stroke={BRAND_COLORS.orange}
                    strokeWidth="1.5"
                    opacity={line2Opacity}
                  />
                </svg>
              </div>
            </div>
          </div>
        </Device3D>
      </div>
    </AbsoluteFill>
  );
};
