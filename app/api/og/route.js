import { ImageResponse } from '@vercel/og';

// Use the new route segment config format
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // Get the query parameters with fallbacks
  const title = searchParams.get('title') || 'Untitled Page';
  const author = searchParams.get('author') || 'Anonymous';
  const content = searchParams.get('content') || 'No content available';

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
        {/* Author badge */}
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
          By {author}
        </div>

        {/* Title */}
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
          {title}
        </div>

        {/* Content with gradient fade */}
        <div
          style={{
            fontSize: 32,
            color: '#ffffff',
            opacity: 0.8,
            lineHeight: 1.4,
          }}
        >
          {content}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
} 