import { ImageResponse } from 'next/og';

// Set Edge runtime
export const runtime = 'edge';

// Define image size
export const size = {
  width: 1200,
  height: 630,
};

export async function GET() {
  try {
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
            fontSize: 60,
            fontWeight: 'bold',
            textAlign: 'center',
            padding: 40,
          }}
        >
          <div>WeWrite OpenGraph</div>
          <div style={{ fontSize: 30, marginTop: 20, opacity: 0.8 }}>
            Static Test Image
          </div>
        </div>
      ),
      {
        ...size,
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (e) {
    console.error('Error generating static OG image:', e);
    return new Response('Failed to generate image', {
      status: 500,
    });
  }
}
