import { ImageResponse } from 'next/og';

// Set Edge runtime
export const runtime = 'edge';

// Define image size
export const size = {
  width: 1200,
  height: 630,
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id;

    if (!pageId) {
      return new Response('Page ID is required', { status: 400 });
    }

    // For now, use static data to ensure the image generation works
    // In production, you would fetch this data from your database
    const title = 'Page: ' + pageId;
    const author = 'Sample Author';
    const bodyText = 'This is sample content for the OpenGraph image. In a real implementation, this would be the actual content of the page that would be fetched from the database. The content would be truncated to fit nicely in the image.';

    // Create the OG image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'black',
            color: 'white',
            padding: 40,
            textAlign: 'center',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 60,
              fontWeight: 'bold',
              marginBottom: 20,
            }}
          >
            {title}
          </div>

          {/* Body content - simplified */}
          <div
            style={{
              fontSize: 30,
              opacity: 0.9,
              marginBottom: 40,
              maxWidth: '80%',
            }}
          >
            {bodyText.substring(0, 100)}...
          </div>

          {/* Author */}
          <div
            style={{
              fontSize: 24,
              opacity: 0.8,
            }}
          >
            by {author}
          </div>

          {/* Read more text */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              fontSize: 24,
              opacity: 0.7,
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
      ),
      {
        ...size,
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (e) {
    console.error('Error generating OG image:', e);
    return new Response('Failed to generate image', {
      status: 500,
      headers: {
        'content-type': 'text/plain',
      },
    });
  }
}
