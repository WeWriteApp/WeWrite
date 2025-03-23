import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getPageMetadata } from '../../firebase/database';

export const runtime = 'nodejs'; // Use Node.js runtime instead of edge

// Define a default image in case of any errors
const generateDefaultImage = (pageId?: string) => {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom, #000000, #111827)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
        }}
      >
        <div>
          <div
            style={{
              color: 'white',
              fontSize: '60px',
              fontWeight: 'bold',
              lineHeight: 1.2,
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            WeWrite Page
          </div>
          {pageId && (
            <div
              style={{
                color: 'white',
                fontSize: '24px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: '8px 16px',
                borderRadius: '20px',
                display: 'inline-block',
              }}
            >
              ID: {pageId}
            </div>
          )}
        </div>
        
        <div
          style={{
            color: 'white',
            opacity: 0.8,
            fontSize: '24px',
          }}
        >
          WeWrite • Collaborative Writing Platform
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
};

export async function GET(request: NextRequest) {
  try {
    // Extract page ID from the URL search params
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('id');

    // If no page ID, return a default image
    if (!pageId) {
      return generateDefaultImage();
    }

    // Try to fetch page data
    let title = 'WeWrite Page';
    let author = 'Anonymous';
    
    // Define the correct type
    type PageMetadata = {
      id: string;
      title?: string;
      username?: string;
      content?: any;
      createdAt?: string;
      lastModified?: string;
      isPublic?: boolean;
      description?: string;
    };

    try {
      const pageData = await getPageMetadata(pageId) as PageMetadata | null;
      if (pageData) {
        title = pageData.title || 'Untitled Page';
        author = pageData.username || 'Anonymous';
      }
    } catch (error) {
      console.error('Error fetching page data for OG image:', error);
      // On error, still continue with default values
    }
    
    // Return the page-specific image
    return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(to bottom, #000000, #111827)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '80px',
          }}
        >
          <div>
            <div
              style={{
                color: 'white',
                fontSize: '60px',
                fontWeight: 'bold',
                lineHeight: 1.2,
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              {title}
            </div>
            <div
              style={{
                color: 'white',
                fontSize: '24px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: '8px 16px',
                borderRadius: '20px',
                display: 'inline-block',
              }}
            >
              By {author}
            </div>
          </div>
          
          <div
            style={{
              color: 'white',
              opacity: 0.8,
              fontSize: '24px',
            }}
          >
            WeWrite • Collaborative Writing Platform
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    // Catch-all error handler
    console.error('Unexpected error generating OG image:', error);
    return generateDefaultImage();
  }
}
