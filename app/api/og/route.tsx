import { ImageResponse } from 'next/og';

// Set Edge runtime
export const runtime = 'edge';

// Set the content type and cache headers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get parameters from the request
    const pageId = searchParams.get('id');
    const type = searchParams.get('type') || 'page';
    const title = searchParams.get('title');
    const author = searchParams.get('author');

    if (!pageId) {
      return new ImageResponse(
        (
          <div
            style={{
              backgroundColor: 'black',
              backgroundSize: '150px 150px',
              height: '100%',
              width: '100%',
              display: 'flex',
              textAlign: 'center',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              flexWrap: 'nowrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 20,
              }}
            >
              <span
                style={{
                  fontSize: 60,
                  fontStyle: 'normal',
                  letterSpacing: '-0.025em',
                  color: 'white',
                  marginTop: 30,
                  marginBottom: 10,
                  padding: '0 120px',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                WeWrite
              </span>
            </div>
            <div
              style={{
                fontSize: 30,
                fontStyle: 'normal',
                letterSpacing: '-0.025em',
                color: 'white',
                opacity: 0.6,
                marginTop: 10,
                padding: '0 120px',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
              }}
            >
              Write together
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
    }

    // Generate dynamic content based on type and parameters
    let displayTitle = title || `Content ${pageId.substring(0, 8)}...`;
    let displayAuthor = author || 'WeWrite User';
    let typeLabel = '';
    let sponsorCount = 8; // Default for demo

    switch (type) {
      case 'group':
        typeLabel = 'Group';
        displayTitle = title || `Group ${pageId.substring(0, 8)}...`;
        displayAuthor = author || 'WeWrite Community';
        break;
      case 'user':
        typeLabel = 'Profile';
        displayTitle = title || `User Profile`;
        displayAuthor = author || displayTitle;
        break;
      default:
        typeLabel = 'Page';
        displayTitle = title || `Page ${pageId.substring(0, 8)}...`;
    }

    // Sample content with links for the demo
    const contentWithLinks = `
      Body content <span style="color: #3b82f6; background-color: #3b82f6; padding: 5px 15px; border-radius: 20px; color: white;">link</span> blah blah text from body, 
      content blah blah <span style="color: #3b82f6; background-color: #3b82f6; padding: 5px 15px; border-radius: 20px; color: white;">another link</span> content blah blah, 
      <span style="color: #3b82f6; background-color: #3b82f6; padding: 5px 15px; border-radius: 20px; color: white;">another link</span> blahhhh blahhhh blahhhh blahhhh
    `;

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: 'black',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '60px 70px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Page Title */}
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.2,
              marginBottom: '40px',
            }}
          >
            {displayTitle}
          </div>
          
          {/* Page Content with Links */}
          <div
            style={{
              fontSize: 36,
              color: 'white',
              lineHeight: 1.5,
              marginBottom: '30px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
            dangerouslySetInnerHTML={{ __html: contentWithLinks }}
          />
          
          {/* Author and Sponsors */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: 'white',
                opacity: 0.8,
                padding: '10px 25px',
                borderRadius: '40px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              By {displayAuthor}
            </div>
            
            <div
              style={{
                fontSize: 28,
                color: 'white',
                opacity: 0.8,
                padding: '10px 25px',
                borderRadius: '40px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {Number(sponsorCount) === 1 ? '1 sponsor' : `${sponsorCount} sponsors`}
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
    console.error(e);
    return new Response('Failed to generate OG image', { 
      status: 500,
      headers: {
        'content-type': 'text/plain',
      },
    });
  }
}
