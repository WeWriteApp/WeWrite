import { ImageResponse } from 'next/og';
import { getPageMetadata } from '../../firebase/database';
 
// Route segment config
export const runtime = 'edge';
 
// Image metadata
export const alt = 'WeWrite Page';
export const size = {
  width: 1200,
  height: 630,
};

// Define types for page data
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

// Font loading needs to be done directly here for the edge runtime
export default async function Image({ params }: { params: { id: string } }) {
  // Get page data - with simple error handling
  let title = 'WeWrite Page';
  let author = 'Anonymous';
  
  try {
    const pageData = await getPageMetadata(params.id) as PageMetadata | null;
    if (pageData) {
      title = pageData.title || 'Untitled Page';
      author = pageData.username || 'Anonymous';
    }
  } catch (error) {
    console.error('Error fetching page data for OG image:', error);
  }
 
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
      ...size,
    }
  );
}
