import { ImageResponse } from '@vercel/og';

// Use the new route segment config format
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('Raw search params:', searchParams.toString());
    console.log('Search params:', Object.fromEntries(searchParams.entries()));

    // Get the query parameters with fallbacks
    const title = searchParams.get('title') || 'Untitled Page';
    const rawAuthor = searchParams.get('author');
    const rawContent = searchParams.get('content');

    console.log('Raw values:', { title, rawAuthor, rawContent });

    // Process author - if null, undefined, or 'NULL', show NULL
    const author = !rawAuthor || rawAuthor === 'null' || rawAuthor === 'NULL' 
      ? 'NULL'
      : rawAuthor;

    // Process content - only show "No content available" if truly empty or "null"
    const content = !rawContent || rawContent === 'null' || rawContent === 'undefined' || rawContent.trim() === '' 
      ? 'No content available'
      : decodeURIComponent(rawContent);

    console.log('Processed values:', { title, author, content });

    // Truncate content to prevent overflow
    const truncatedContent = content.length > 150 
      ? content.substring(0, 150) + '...' 
      : content;

    console.log('Final content to display:', truncatedContent);

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
            {author === 'NULL' ? 'NULL' : `By ${author}`}
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
            {truncatedContent}
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
        // Disable caching for development
        headers: {
          'cache-control': 'no-cache, no-store',
        },
      }
    );
  } catch (e) {
    console.error('Error generating image:', e);
    console.error('Error stack:', e.stack);
    return new Response(`Failed to generate image: ${e.message}`, {
      status: 500,
    });
  }
} 