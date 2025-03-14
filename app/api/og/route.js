import { ImageResponse } from '@vercel/og';
import { NextResponse } from 'next/server';

// Use the new route segment config format
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Allow caching for production, disable for development
export const revalidate = process.env.NODE_ENV === 'production' ? 3600 : 0;

async function generateImage(params) {
  try {
    const title = params.title || 'Untitled Page';
    const author = params.author || 'Anonymous';
    const content = params.content || '';

    console.log('Generating image with:', { title, author, content });

    // Truncate content if needed
    const truncatedContent = content.length > 150 
      ? content.substring(0, 150) + '...' 
      : content;

    // Create a complete image in one go
    const image = new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000000',
            padding: '40px 60px',
            position: 'relative',
          }}
        >
          {/* Author badge */}
          <div
            style={{
              position: 'absolute',
              top: '40px',
              right: '60px',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '8px 24px',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 28,
              color: '#ffffff',
              fontWeight: 500,
            }}
          >
            {author === 'Anonymous' ? 'Anonymous' : `By ${author}`}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: '#ffffff',
              marginTop: 40,
              marginBottom: 40,
              lineHeight: 1.2,
              maxWidth: '80%',
            }}
          >
            {title}
          </div>

          {/* Content preview */}
          <div
            style={{
              fontSize: 36,
              color: '#ffffff',
              opacity: 0.9,
              lineHeight: 1.5,
              maxWidth: '85%',
              backgroundColor: '#000000',
            }}
          >
            {truncatedContent || 'No content available'}
          </div>

          {/* WeWrite branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '60px',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: 24,
              fontWeight: 500,
            }}
          >
            on WeWrite
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Add emoji support
        emoji: 'twemoji',
        headers: {
          'content-type': 'image/png',
          'cache-control': process.env.NODE_ENV === 'production'
            ? 'public, max-age=3600, s-maxage=3600'
            : 'no-cache, no-store',
        },
      }
    );

    return image;
  } catch (e) {
    console.error('Error generating image:', e);
    throw e;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('POST request body:', body);
    return generateImage(body);
  } catch (e) {
    console.error('Error in POST handler:', e);
    return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('Request URL:', request.url);
    console.log('Search params:', Object.fromEntries(searchParams.entries()));

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
          {/* Title */}
          <div
            style={{
              fontSize: 60,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              marginBottom: 20,
            }}
          >
            {title}
          </div>

          {/* Author */}
          <div
            style={{
              fontSize: 30,
              color: '#ffffff',
              opacity: 0.8,
              marginBottom: 20,
            }}
          >
            By {author}
          </div>

          {/* Content */}
          <div
            style={{
              fontSize: 36,
              color: '#ffffff',
              opacity: 0.9,
              lineHeight: 1.5,
            }}
          >
            {content}
          </div>

          {/* WeWrite branding */}
          <div
            style={{
              marginTop: 'auto',
              color: '#ffffff',
              opacity: 0.5,
              fontSize: 24,
              textAlign: 'right',
            }}
          >
            on WeWrite
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error('Error generating image:', e);
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000000',
            padding: '40px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: '#ff0000', fontSize: 48 }}>
            Error Generating Image
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
} 