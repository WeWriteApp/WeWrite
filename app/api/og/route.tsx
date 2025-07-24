import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  console.log('🖼️ [OG] Minimal route called');
  
  try {
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: '#ff0000',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ color: 'white', fontSize: 48 }}>
            MINIMAL TEST WORKING
          </div>
        </div>
      ),
      { 
        width: 1200, 
        height: 630,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      }
    );
  } catch (error) {
    console.error('🖼️ [OG] Error:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
