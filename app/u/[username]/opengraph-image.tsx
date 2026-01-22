import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'WeWrite User Profile';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface UserData {
  uid: string;
  username: string;
  bio?: string;
  totalPages?: number;
  publicPages?: number;
  profilePicture?: string;
}

async function fetchUserData(username: string): Promise<UserData | null> {
  try {
    // Use Firebase REST API directly to bypass Vercel bot protection
    // Query users collection where username matches
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-cee96';

    // First, query by username field
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'username' },
            op: 'EQUAL',
            value: { stringValue: username }
          }
        },
        limit: 1
      }
    };

    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryBody),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`Firebase REST API returned ${response.status} for user ${username}`);
      return null;
    }

    const results = await response.json();

    // Check if we got any results
    if (!results || !results[0] || !results[0].document) {
      return null;
    }

    const doc = results[0].document;
    const fields = doc.fields;

    // Helper to extract Firestore field values
    const getValue = (field: any): any => {
      if (!field) return undefined;
      if (field.stringValue !== undefined) return field.stringValue;
      if (field.integerValue !== undefined) return parseInt(field.integerValue);
      if (field.doubleValue !== undefined) return field.doubleValue;
      if (field.booleanValue !== undefined) return field.booleanValue;
      return undefined;
    };

    // Extract user ID from document path
    const docPath = doc.name;
    const uid = docPath.split('/').pop();

    return {
      uid: uid || '',
      username: getValue(fields.username) || username,
      bio: getValue(fields.bio),
      totalPages: getValue(fields.totalPages),
      publicPages: getValue(fields.publicPages),
      profilePicture: getValue(fields.profilePicture),
    };
  } catch (error) {
    console.warn(`Error fetching user data for OG image ${username}:`, error);
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  // Fetch user data
  const userData = await fetchUserData(username);

  // If no user data, return default WeWrite branding
  if (!userData) {
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: '#000000',
            height: '100%',
            width: '100%',
            display: 'flex',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: 'white',
              marginBottom: 20
            }}
          >
            WeWrite
          </div>
          <div
            style={{
              fontSize: 32,
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: 40
            }}
          >
            User Profile
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // Extract display values
  const displayUsername = userData.username || username;
  const displayBio = typeof userData.bio === 'string' ? userData.bio : '';
  const publicPageCount = userData.publicPages || userData.totalPages || 0;

  // Truncate bio for display
  let displayBioFormatted = displayBio.substring(0, 280);
  if (displayBio.length > 280) {
    displayBioFormatted = displayBio.substring(0, 277) + '...';
  }

  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#000',
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px',
          fontFamily: 'system-ui',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Blurred gradient blobs - bigger and brighter */}
        <div
          style={{
            position: 'absolute',
            top: '-300px',
            left: '-150px',
            width: '800px',
            height: '800px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-350px',
            right: '-100px',
            width: '900px',
            height: '900px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: '200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.35) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Subtle sparkles */}
        <div style={{ position: 'absolute', top: '80px', left: '120px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.8)' }} />
        <div style={{ position: 'absolute', top: '150px', right: '180px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.6)' }} />
        <div style={{ position: 'absolute', top: '200px', left: '350px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.7)' }} />
        <div style={{ position: 'absolute', top: '100px', right: '400px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.5)' }} />
        <div style={{ position: 'absolute', top: '280px', left: '800px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.6)' }} />
        <div style={{ position: 'absolute', top: '60px', right: '300px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} />
        <div style={{ position: 'absolute', top: '320px', left: '200px', width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.5)' }} />
        <div style={{ position: 'absolute', top: '180px', right: '600px', width: '2px', height: '2px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.7)' }} />

        {/* Username as main title */}
        <div style={{
          fontSize: '72px',
          fontWeight: 900,
          lineHeight: '1.1',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          marginBottom: '16px',
        }}>
          {displayUsername}
        </div>

        {/* Page count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
        }}>
          <div style={{
            fontSize: '24px',
            color: 'rgba(255, 255, 255, 0.7)',
          }}>
            {publicPageCount} {publicPageCount === 1 ? 'page' : 'pages'}
          </div>
        </div>

        {/* Bio section - prominently displayed */}
        {displayBioFormatted && (
          <div style={{
            display: 'flex',
            fontSize: '32px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: '1.5',
            flex: 1,
            maxWidth: '900px',
          }}>
            {displayBioFormatted}
          </div>
        )}

        {/* Gradient fade above footer */}
        <div style={{
          position: 'absolute',
          bottom: '120px',
          left: '0px',
          right: '0px',
          height: '100px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.7) 50%, rgba(0, 0, 0, 1) 100%)',
          pointerEvents: 'none'
        }} />

        {/* Footer bar */}
        <div style={{
          position: 'absolute',
          bottom: '0px',
          left: '0px',
          right: '0px',
          height: '120px',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '60px',
          paddingRight: '60px',
          paddingTop: '20px',
          paddingBottom: '20px',
          gap: '16px'
        }}>
          {/* WeWrite Logo */}
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            <svg width="70" height="70" viewBox="0 0 1024 1024" fill="none">
              <rect width="1024" height="1024" fill="white"/>
              <rect x="227" y="132" width="665" height="40" fill="#D9D9D9"/>
              <rect x="132" y="222" width="760" height="40" fill="#D9D9D9"/>
              <rect x="132" y="312" width="719" height="40" fill="#D9D9D9"/>
              <rect x="132" y="402" width="687" height="40" fill="#D9D9D9"/>
              <rect x="132" y="492" width="719" height="40" fill="#D9D9D9"/>
              <rect x="132" y="582" width="633" height="40" fill="#D9D9D9"/>
              <rect x="132" y="672" width="687" height="40" fill="#D9D9D9"/>
              <rect x="132" y="762" width="633" height="40" fill="#D9D9D9"/>
              <rect x="132" y="852" width="760" height="40" fill="#D9D9D9"/>
              <path d="M807.513 284.461C799.889 320.509 788.451 359.892 778.437 396.615C766.615 439.966 756.536 480.373 753.156 515.281C749.678 551.207 754.227 573.071 762.908 585.385C769.816 595.183 785.543 607.377 829.035 607.377H1122.75C1122.75 607.377 1122.75 607.377 1122.75 647.377C1122.75 687.377 1122.75 687.377 1122.75 687.377H829.035C770.764 687.377 724.896 670.305 697.524 631.482C693.259 625.433 689.638 619.11 686.583 612.583C679.171 623.626 671.233 633.803 662.675 642.852C637.962 668.978 606.295 687.377 567.148 687.377C539.55 687.377 516.843 675.307 501.395 655.179C488.869 638.858 482.326 618.93 478.802 599.765C476.758 603.027 474.698 606.224 472.619 609.348C459.473 629.104 444.546 647.631 427.737 661.594C411.049 675.456 389.346 687.377 363.62 687.377C335.259 687.377 312.464 674.033 298.188 652.23C285.618 633.035 281.017 609.55 279.487 588.205C279.014 581.6 278.809 574.736 278.841 567.669C265.771 584.251 251.83 599.957 237.025 614.186C194.293 655.254 140.739 687.377 77.6191 687.377H-171.243C-171.245 687.373 -171.246 686.997 -171.246 647.377C-171.246 607.757 -171.245 607.381 -171.243 607.377H77.6191C112.164 607.377 146.87 589.875 181.591 556.506C216.206 523.238 247.246 477.52 273.508 429.641C299.595 382.081 319.984 334.215 333.889 298.053C335.715 293.302 337.425 288.761 339.019 284.461H423.957C421.696 291.061 418.922 298.946 415.647 307.881C413.951 313.069 412.157 318.625 410.295 324.498C398.688 361.105 384.544 409.469 373.99 457.467C363.232 506.394 357.048 551.315 359.282 582.486C360.281 596.426 362.754 603.931 364.457 607.257C366.073 606.906 370.038 605.522 376.619 600.056C385.17 592.952 395.132 581.385 406.018 565.027C427.737 532.389 448.844 487.28 467.565 440.034C486.121 393.208 501.615 346.141 512.5 310.63C513.877 306.137 515.178 301.836 516.4 297.75C517.667 293.029 518.879 288.588 520.021 284.461H603.504C603.072 286.017 602.601 287.711 602.089 289.533C599.896 297.341 596.968 307.537 593.381 319.549C592.291 323.622 591.16 327.91 589.999 332.389C580.816 367.822 569.915 414.587 562.658 460.955C555.254 508.265 552.281 551.4 556.795 581.196C559.067 596.197 562.658 603.605 564.857 606.471C565.577 607.408 565.087 607.377 567.148 607.377C578.644 607.377 590.564 602.67 604.556 587.878C619.265 572.327 633.963 547.832 648.773 513.907C675.247 453.268 697.749 373.224 723.142 284.461H807.513Z" fill="black"/>
            </svg>
          </div>

          {/* WeWrite text */}
          <div style={{
            fontSize: 31,
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            WeWrite
          </div>

          {/* View profile button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 31,
            fontWeight: '700',
            color: '#ffffff',
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            padding: '0px 40px',
            borderRadius: '50px',
            marginLeft: 'auto',
            whiteSpace: 'nowrap',
            height: '70px',
            boxSizing: 'border-box',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(59, 130, 246, 0.4), 0 4px 20px rgba(59, 130, 246, 0.5)'
          }}>
            View profile →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
