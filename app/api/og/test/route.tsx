import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Set Edge runtime
export const runtime = 'edge';

// Set the content type and cache headers
export async function GET(request: NextRequest) {
  try {
    // Static test data
    const title = 'Test Page Title';
    const author = 'Test Author';
    const bodyText = 'This is a test page for OpenGraph image generation. This content is static and is used to verify that the image generation is working correctly.';

    // Create the OG image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            backgroundColor: 'black',
            padding: '60px 80px',
            position: 'relative',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Title */}
          <div
            style={{
              color: 'white',
              fontSize: '60px',
              fontWeight: 'bold',
              lineHeight: 1.2,
              marginBottom: '30px',
              maxWidth: '90%',
            }}
          >
            {title}
          </div>
          
          {/* Body content */}
          <div
            style={{
              color: 'white',
              fontSize: '32px',
              lineHeight: 1.4,
              opacity: 0.9,
              marginBottom: '40px',
              maxWidth: '90%',
              position: 'relative',
            }}
          >
            {bodyText}
          </div>
          
          {/* Author */}
          <div
            style={{
              color: 'white',
              fontSize: '24px',
              opacity: 0.8,
              marginTop: 'auto',
            }}
          >
            by {author}
          </div>
          
          {/* Gradient overlay at the bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '200px',
              background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              padding: '40px',
            }}
          >
            <div
              style={{
                color: 'white',
                fontSize: '24px',
                opacity: 0.7,
                fontWeight: 'medium',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Read more on WeWrite
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{ marginLeft: '8px' }}
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Add explicit content type and cache headers
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, immutable, no-transform, max-age=31536000',
        },
      },
    );
  } catch (e) {
    console.error('Error generating OG image:', e);
    return new Response('Failed to generate OG image', { 
      status: 500,
      headers: {
        'content-type': 'text/plain',
      },
    });
  }
}
