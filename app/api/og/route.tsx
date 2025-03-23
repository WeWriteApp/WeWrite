import { ImageResponse } from 'next/og';

// Force stable runtime
export const runtime = 'nodejs';

// This is a static basic image for testing
export async function GET(request: Request) {
  try {
    // Create a very minimal image
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            color: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 60, fontWeight: 'bold' }}>WeWrite</div>
            <div style={{ fontSize: 30, marginTop: 20 }}>OpenGraph Test Image</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return new Response(`Failed to generate image: ${e.message}`, {
      status: 500,
    });
  }
}
