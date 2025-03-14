import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const revalidate = process.env.NODE_ENV === 'production' ? 3600 : 0;

export async function GET(request, { params }) {
  try {
    console.log('Raw params:', JSON.stringify(params));

    // Get parameters from the URL path segments
    const segments = params.params || [];
    console.log('Raw segments:', JSON.stringify(segments));

    const [titleSegment = '', authorSegment = '', ...contentSegments] = segments;
    
    // Decode and validate each parameter, handling edge cases
    const title = decodeURIComponent(titleSegment || '').replace(/^NULL$/i, '') || 'Untitled Page';
    const author = decodeURIComponent(authorSegment || '').replace(/^NULL$/i, '') || 'Anonymous';
    const content = contentSegments.length > 0 
      ? decodeURIComponent(contentSegments.join('/')).replace(/^NULL$/i, '')
      : 'No content available';

    console.log('Processed parameters:', {
      title,
      author,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
    });

    // Generate the image
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
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              flex: 1,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 60,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.2,
                wordBreak: 'break-word',
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
                marginTop: 20,
                wordBreak: 'break-word',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {content}
            </div>
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
        emoji: 'twemoji',
      }
    );

    return new Response(image.body, {
      headers: {
        'content-type': 'image/png',
        'cache-control': process.env.NODE_ENV === 'production'
          ? 'public, max-age=3600, s-maxage=3600'
          : 'no-cache, no-store',
      },
    });
  } catch (e) {
    console.error('Error generating image:', e.message);
    console.error('Error stack:', e.stack);
    
    // Return a basic error image instead of text
    const errorImage = new ImageResponse(
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
          <div style={{ color: '#ff0000', fontSize: 48, marginBottom: 20 }}>
            Error Generating Image
          </div>
          <div style={{ color: '#ffffff', fontSize: 24, textAlign: 'center', maxWidth: '80%', wordBreak: 'break-word' }}>
            {e.message}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    return new Response(errorImage.body, {
      headers: {
        'content-type': 'image/png',
      },
    });
  }
} 