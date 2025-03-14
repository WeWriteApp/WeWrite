import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

// Disable the default middleware for this route
export const config = {
  matcher: '/api/og',
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const content = searchParams.get('content');
    const author = searchParams.get('author');

    // Return error if required params are missing
    if (!title || !content || !author) {
      return new Response('Missing required parameters', { status: 400 });
    }

    // Split content into words and limit to first 50 words
    const words = content.split(' ').slice(0, 50);
    const truncatedContent = words.join(' ') + (words.length >= 50 ? '...' : '');

    const response = new ImageResponse(
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
              background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {truncatedContent}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    // Add the bypass token header for Vercel preview deployments
    response.headers.set('x-vercel-protection-bypass', process.env.VERCEL_PREVIEW_TOKEN || '');
    
    return response;
  } catch (e) {
    console.error(e);
    return new Response('Failed to generate image', { status: 500 });
  }
} 