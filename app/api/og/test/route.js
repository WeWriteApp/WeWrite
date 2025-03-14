import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#000000',
          padding: '40px 60px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '60px',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '8px 16px',
            borderRadius: '100px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 24,
            color: '#ffffff',
          }}
        >
          By Test User
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 600,
            color: '#ffffff',
            marginTop: 40,
            marginBottom: 20,
            lineHeight: 1.2,
          }}
        >
          Test Title
        </div>

        <div
          style={{
            fontSize: 32,
            color: '#ffffff',
            opacity: 0.8,
            lineHeight: 1.4,
          }}
        >
          This is a test OpenGraph image to verify the image generation is working correctly.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
} 