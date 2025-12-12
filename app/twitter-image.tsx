import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata - Twitter prefers 1200x628
export const alt = 'WeWrite - Collaborative Writing Platform';
export const size = {
  width: 1200,
  height: 628,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'linear-gradient(to bottom, #000000, #111827)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '50px 80px',
        }}
      >
        <div
          style={{
            backgroundImage: 'linear-gradient(to bottom right, #60A5FA, #ffffff)',
            backgroundClip: 'text',
            color: 'transparent',
            fontSize: '100px',
            fontWeight: 'bold',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          WeWrite
        </div>
        <div
          style={{
            color: 'white',
            fontSize: '36px',
            fontWeight: 'normal',
            textAlign: 'center',
          }}
        >
          Collaborative Writing Platform
        </div>
      </div>
    ),
    { ...size }
  );
}
