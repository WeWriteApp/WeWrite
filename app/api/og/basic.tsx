import { ImageResponse } from 'next/og';

// Force stable runtime 
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('id') || 'no-id';
    
    // Create a very basic image with minimal styling
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: 'black',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: 60,
              fontWeight: 'bold',
              marginBottom: 20,
            }}
          >
            WeWrite
          </div>
          <div
            style={{
              color: 'white',
              fontSize: 30,
            }}
          >
            Page ID: {pageId}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error(`OG image generation error: ${e.message}`);
    return new Response(`Error generating image: ${e.message}`, { status: 500 });
  }
}
