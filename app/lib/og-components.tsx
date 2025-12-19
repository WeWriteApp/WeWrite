/**
 * Shared OpenGraph Image Components
 *
 * This file contains reusable components and styles for OG images.
 * All OG images should import from here to ensure consistency.
 *
 * Usage in opengraph-image.tsx files:
 * ```tsx
 * import { OG_STYLES, OGBlobs, OGSparkles, OGFooter, OGTitle, OGSubtitle } from '@/app/lib/og-components';
 * ```
 */

import React from 'react';

// ============================================================================
// DESIGN TOKENS
// ============================================================================

export const OG_STYLES = {
  // Dimensions
  width: 1200,
  height: 630,

  // Colors
  colors: {
    background: '#000',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.85)',
    textMuted: 'rgba(255, 255, 255, 0.7)',

    // Blob colors
    blue: 'rgba(59, 130, 246, 0.5)',
    blueBright: 'rgba(59, 130, 246, 0.55)',
    blueLight: 'rgba(96, 165, 250, 0.5)',
    blueDark: 'rgba(37, 99, 235, 0.45)',
    purple: 'rgba(139, 92, 246, 0.45)',
    green: 'rgba(34, 197, 94, 0.35)',
    greenBright: 'rgba(34, 197, 94, 0.5)',
    orange: 'rgba(249, 115, 22, 0.5)',
    red: 'rgba(239, 68, 68, 0.45)',
  },

  // Typography
  fonts: {
    family: 'system-ui',
    title: {
      size: 64,
      weight: 900,
      lineHeight: 1.1,
    },
    titleLarge: {
      size: 72,
      weight: 900,
      lineHeight: 1.2,
    },
    subtitle: {
      size: 28,
      weight: 500,
      lineHeight: 1.5,
    },
    body: {
      size: 26,
      weight: 500,
      lineHeight: 1.6,
    },
    small: {
      size: 20,
      weight: 400,
      lineHeight: 1.5,
    },
  },

  // Shadows
  shadows: {
    text: '0 2px 10px rgba(0, 0, 0, 0.3)',
    logo: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
  },

  // Blobs
  blobs: {
    sizeSmall: 600,
    sizeMedium: 800,
    sizeLarge: 900,
    blur: 80,
  },

  // Sparkles
  sparkles: {
    sizes: [2, 3, 4],
    opacities: [0.5, 0.6, 0.7, 0.8, 0.9],
  },
} as const;

// ============================================================================
// BLOB PRESETS
// ============================================================================

export type BlobTheme = 'default' | 'blue' | 'orange' | 'green';

export const BLOB_THEMES: Record<BlobTheme, { blob1: string; blob2: string; blob3: string }> = {
  default: {
    blob1: OG_STYLES.colors.blue,
    blob2: OG_STYLES.colors.purple,
    blob3: OG_STYLES.colors.green,
  },
  blue: {
    blob1: OG_STYLES.colors.blueBright,
    blob2: OG_STYLES.colors.blueLight,
    blob3: OG_STYLES.colors.blueDark,
  },
  orange: {
    blob1: OG_STYLES.colors.orange,
    blob2: OG_STYLES.colors.red,
    blob3: OG_STYLES.colors.green,
  },
  green: {
    blob1: OG_STYLES.colors.greenBright,
    blob2: OG_STYLES.colors.blue,
    blob3: OG_STYLES.colors.purple,
  },
};

// ============================================================================
// COMPONENT STYLES (for inline use in ImageResponse)
// ============================================================================

/**
 * Base container style for all OG images
 */
export const ogContainerStyle: React.CSSProperties = {
  backgroundColor: OG_STYLES.colors.background,
  width: `${OG_STYLES.width}px`,
  height: `${OG_STYLES.height}px`,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: OG_STYLES.fonts.family,
  color: OG_STYLES.colors.textPrimary,
  position: 'relative',
  overflow: 'hidden',
};

/**
 * Title text style
 */
export const ogTitleStyle: React.CSSProperties = {
  fontSize: `${OG_STYLES.fonts.title.size}px`,
  fontWeight: OG_STYLES.fonts.title.weight,
  color: OG_STYLES.colors.textPrimary,
  lineHeight: OG_STYLES.fonts.title.lineHeight,
  textShadow: OG_STYLES.shadows.text,
};

/**
 * Large title text style (for content pages)
 */
export const ogTitleLargeStyle: React.CSSProperties = {
  fontSize: `${OG_STYLES.fonts.titleLarge.size}px`,
  fontWeight: OG_STYLES.fonts.titleLarge.weight,
  color: OG_STYLES.colors.textPrimary,
  lineHeight: OG_STYLES.fonts.titleLarge.lineHeight,
  textShadow: OG_STYLES.shadows.text,
};

/**
 * Subtitle text style
 */
export const ogSubtitleStyle: React.CSSProperties = {
  fontSize: `${OG_STYLES.fonts.subtitle.size}px`,
  fontWeight: OG_STYLES.fonts.subtitle.weight,
  color: OG_STYLES.colors.textSecondary,
  lineHeight: OG_STYLES.fonts.subtitle.lineHeight,
};

/**
 * Body text style
 */
export const ogBodyStyle: React.CSSProperties = {
  fontSize: `${OG_STYLES.fonts.body.size}px`,
  fontWeight: OG_STYLES.fonts.body.weight,
  color: OG_STYLES.colors.textSecondary,
  lineHeight: OG_STYLES.fonts.body.lineHeight,
};

// ============================================================================
// JSX COMPONENTS (for use in ImageResponse)
// ============================================================================

interface OGBlobsProps {
  theme?: BlobTheme;
}

/**
 * Renders 3 gradient blobs with the specified color theme
 */
export function OGBlobs({ theme = 'default' }: OGBlobsProps) {
  const colors = BLOB_THEMES[theme];

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '-300px',
          left: '-150px',
          width: `${OG_STYLES.blobs.sizeMedium}px`,
          height: `${OG_STYLES.blobs.sizeMedium}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.blob1} 0%, transparent 70%)`,
          filter: `blur(${OG_STYLES.blobs.blur}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-350px',
          right: '-100px',
          width: `${OG_STYLES.blobs.sizeLarge}px`,
          height: `${OG_STYLES.blobs.sizeLarge}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.blob2} 0%, transparent 70%)`,
          filter: `blur(${OG_STYLES.blobs.blur}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50px',
          right: '200px',
          width: `${OG_STYLES.blobs.sizeSmall}px`,
          height: `${OG_STYLES.blobs.sizeSmall}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.blob3} 0%, transparent 70%)`,
          filter: `blur(${OG_STYLES.blobs.blur}px)`,
        }}
      />
    </>
  );
}

/**
 * Renders subtle sparkle dots
 * Note: Using explicit elements instead of .map() for edge runtime compatibility
 */
export function OGSparkles() {
  return (
    <>
      <div style={{ position: 'absolute', top: '80px', left: '120px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.8)' }} />
      <div style={{ position: 'absolute', top: '150px', right: '180px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.6)' }} />
      <div style={{ position: 'absolute', top: '200px', left: '350px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.7)' }} />
      <div style={{ position: 'absolute', top: '100px', right: '400px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.5)' }} />
      <div style={{ position: 'absolute', top: '280px', left: '800px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.6)' }} />
      <div style={{ position: 'absolute', top: '60px', right: '300px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} />
      <div style={{ position: 'absolute', top: '320px', left: '200px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.5)' }} />
      <div style={{ position: 'absolute', top: '180px', right: '600px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.7)' }} />
    </>
  );
}

interface OGFooterProps {
  showBranding?: boolean;
}

/**
 * Renders the WeWrite logo footer with gradient fade
 */
export function OGFooter({ showBranding = true }: OGFooterProps) {
  if (!showBranding) return null;

  return (
    <>
      {/* Gradient fade above footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '100px',
          left: '0px',
          right: '0px',
          height: '80px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 1) 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Footer bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '0px',
          left: '0px',
          right: '0px',
          height: '100px',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '60px',
          paddingRight: '60px',
          gap: '20px',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            backgroundColor: '#000',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: OG_STYLES.shadows.logo,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 1024 1024" fill="none">
            <path d="M807.513 284.461C799.889 320.509 788.451 359.892 778.437 396.615C766.615 439.966 756.536 480.373 753.156 515.281C749.678 551.207 754.227 573.071 762.908 585.385C769.816 595.183 785.543 607.377 829.035 607.377H1122.75C1122.75 607.377 1122.75 607.377 1122.75 647.377C1122.75 687.377 1122.75 687.377 1122.75 687.377H829.035C770.764 687.377 724.896 670.305 697.524 631.482C693.259 625.433 689.638 619.11 686.583 612.583C679.171 623.626 671.233 633.803 662.675 642.852C637.962 668.978 606.295 687.377 567.148 687.377C539.55 687.377 516.843 675.307 501.395 655.179C488.869 638.858 482.326 618.93 478.802 599.765C476.758 603.027 474.698 606.224 472.619 609.348C459.473 629.104 444.546 647.631 427.737 661.594C411.049 675.456 389.346 687.377 363.62 687.377C335.259 687.377 312.464 674.033 298.188 652.23C285.618 633.035 281.017 609.55 279.487 588.205C279.014 581.6 278.809 574.736 278.841 567.669C265.771 584.251 251.83 599.957 237.025 614.186C194.293 655.254 140.739 687.377 77.6191 687.377H-171.243C-171.245 687.373 -171.246 686.997 -171.246 647.377C-171.246 607.757 -171.245 607.381 -171.243 607.377H77.6191C112.164 607.377 146.87 589.875 181.591 556.506C216.206 523.238 247.246 477.52 273.508 429.641C299.595 382.081 319.984 334.215 333.889 298.053C335.715 293.302 337.425 288.761 339.019 284.461H423.957C421.696 291.061 418.922 298.946 415.647 307.881C413.951 313.069 412.157 318.625 410.295 324.498C398.688 361.105 384.544 409.469 373.99 457.467C363.232 506.394 357.048 551.315 359.282 582.486C360.281 596.426 362.754 603.931 364.457 607.257C366.073 606.906 370.038 605.522 376.619 600.056C385.17 592.952 395.132 581.385 406.018 565.027C427.737 532.389 448.844 487.28 467.565 440.034C486.121 393.208 501.615 346.141 512.5 310.63C513.877 306.137 515.178 301.836 516.4 297.75C517.667 293.029 518.879 288.588 520.021 284.461H603.504C603.072 286.017 602.601 287.711 602.089 289.533C599.896 297.341 596.968 307.537 593.381 319.549C592.291 323.622 591.16 327.91 589.999 332.389C580.816 367.822 569.915 414.587 562.658 460.955C555.254 508.265 552.281 551.4 556.795 581.196C559.067 596.197 562.658 603.605 564.857 606.471C565.577 607.408 565.087 607.377 567.148 607.377C578.644 607.377 590.564 602.67 604.556 587.878C619.265 572.327 633.963 547.832 648.773 513.907C675.247 453.268 697.749 373.224 723.142 284.461H807.513Z" fill="white"/>
          </svg>
        </div>
        <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>WeWrite</div>
      </div>
    </>
  );
}

interface OGTitleProps {
  children: React.ReactNode;
  size?: 'default' | 'large';
  centered?: boolean;
  style?: React.CSSProperties;
}

/**
 * Title component with consistent styling
 */
export function OGTitle({ children, size = 'default', centered = false, style = {} }: OGTitleProps) {
  const baseStyle = size === 'large' ? ogTitleLargeStyle : ogTitleStyle;

  return (
    <div
      style={{
        ...baseStyle,
        textAlign: centered ? 'center' : 'left',
        display: 'flex',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface OGSubtitleProps {
  children: React.ReactNode;
  centered?: boolean;
  style?: React.CSSProperties;
}

/**
 * Subtitle component with consistent styling
 */
export function OGSubtitle({ children, centered = false, style = {} }: OGSubtitleProps) {
  return (
    <div
      style={{
        ...ogSubtitleStyle,
        textAlign: centered ? 'center' : 'left',
        display: 'flex',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Gradient fade overlay for content pages
 */
export function OGGradientFade() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '120px',
        left: '0px',
        right: '0px',
        height: '100px',
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.7) 50%, rgba(0, 0, 0, 1) 100%)',
        pointerEvents: 'none',
      }}
    />
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Strips HTML tags from text
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Extracts plain text from rich content JSON
 */
export function extractPlainText(content: string, maxLength = 300): string {
  if (!content) return '';

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const text = parsed
        .map((node: { children?: { text?: string }[] }) => {
          if (node.children) {
            return node.children
              .map((child) => child.text || '')
              .join('')
              .trim();
          }
          return '';
        })
        .join(' ')
        .trim();
      return truncateText(text, maxLength);
    }
  } catch {
    // Not JSON, treat as plain text
  }

  return truncateText(stripHtml(content), maxLength);
}
