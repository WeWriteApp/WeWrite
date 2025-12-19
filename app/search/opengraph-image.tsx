import { ImageResponse } from 'next/og';
import {
  OG_STYLES,
  OGBlobs,
  OGSparkles,
  OGFooter,
  ogTitleStyle,
  ogSubtitleStyle,
} from '../lib/og-components';

export const runtime = 'edge';

export const alt = 'Search WeWrite';
export const size = {
  width: OG_STYLES.width,
  height: OG_STYLES.height,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: OG_STYLES.colors.background,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          fontFamily: OG_STYLES.fonts.family,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <OGBlobs theme="default" />
        <OGSparkles />

        {/* Search icon */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
          }}
        >
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            ...ogTitleStyle,
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          Search WeWrite
        </div>

        {/* Subtitle */}
        <div
          style={{
            ...ogSubtitleStyle,
            marginBottom: '48px',
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          Find pages, creators, and topics across the entire platform
        </div>

        {/* Search bar preview */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '20px 32px',
            width: '600px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            gap: '16px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <div
            style={{
              fontSize: '20px',
              color: OG_STYLES.colors.textMuted,
            }}
          >
            Search for pages, users, or topics...
          </div>
        </div>

        {/* Quick filters */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              color: OG_STYLES.colors.textMuted,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '10px 20px',
              borderRadius: '20px',
            }}
          >
            Pages
          </div>
          <div
            style={{
              fontSize: '16px',
              color: OG_STYLES.colors.textMuted,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '10px 20px',
              borderRadius: '20px',
            }}
          >
            Users
          </div>
          <div
            style={{
              fontSize: '16px',
              color: OG_STYLES.colors.textMuted,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '10px 20px',
              borderRadius: '20px',
            }}
          >
            Topics
          </div>
        </div>

        <OGFooter />
      </div>
    ),
    { ...size }
  );
}
