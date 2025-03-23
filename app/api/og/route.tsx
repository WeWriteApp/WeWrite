import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';

// Force nodejs runtime
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('id');
    
    if (!pageId) {
      return new ImageResponse(
        (
          <div style={{ 
            backgroundColor: 'black', 
            width: '100%', 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ color: 'white', fontSize: 48, textAlign: 'center' }}>
              WeWrite
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }
    
    // Get title and author from query params as a fallback
    // This allows testing without requiring Firebase
    const title = searchParams.get('title') || 'Page ' + pageId;
    const author = searchParams.get('author') || 'WeWrite User';
    
    return new ImageResponse(
      (
        <div style={{ 
          backgroundColor: 'black', 
          width: '100%', 
          height: '100%',
          padding: '50px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: 'white', fontSize: 60, fontWeight: 'bold', marginBottom: '20px' }}>
              {title}
            </div>
            
            <div style={{ 
              color: 'white', 
              fontSize: 20, 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              padding: '8px 16px', 
              borderRadius: '20px',
              display: 'inline-block'
            }}>
              By {author}
            </div>
          </div>
          
          <div style={{ color: 'white', opacity: 0.7, fontSize: 24 }}>
            WeWrite • Write together
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (error) {
    console.error('OG Image Error:', error);
    // Return a plain error response instead of trying to render an error image
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
