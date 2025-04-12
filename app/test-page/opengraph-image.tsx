import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'Test Page';
export const size = {
  width: 1200,
  height: 630,
};

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <div
          style={{
            fontSize: '60px',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          Test Page
        </div>
        
        <div
          style={{
            fontSize: '30px',
            opacity: 0.9,
            marginBottom: '40px',
            maxWidth: '80%',
          }}
        >
          This is a test page with OpenGraph metadata.
        </div>
        
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '24px',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Read more on WeWrite
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginLeft: '8px' }}
          >
            <path
              d="M5 12H19M19 12L12 5M19 12L12 19"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
