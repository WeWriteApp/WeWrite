import { ImageResponse } from 'next/og';
import { getAdminFirestore } from '../firebase/admin';
import { getCollectionName } from '../utils/environmentConfig';

export const runtime = 'nodejs';

export const alt = 'WeWrite Page';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Helper function to strip HTML and get plain text
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Content segment type for preserving link structure
type ContentSegment = {
  type: 'text' | 'link';
  text: string;
};

// Helper function to extract text from rich content (plain text only)
function extractTextFromContent(content: string | any[]): string {
  if (!content) return '';

  // If content is already an array (from API), process it directly
  let parsed: any[] | null = null;

  if (Array.isArray(content)) {
    parsed = content;
  } else if (typeof content === 'string') {
    try {
      const result = JSON.parse(content);
      if (Array.isArray(result)) {
        parsed = result;
      }
    } catch {
      // If not JSON, treat as plain text/HTML
      return stripHtml(content);
    }
  }

  if (parsed && Array.isArray(parsed)) {
    return parsed
      .map((node: any) => {
        if (node.children) {
          return node.children
            .map((child: any) => {
              if (child.text) {
                return child.text;
              } else if (child.type === 'link' && child.children) {
                return child.children.map((linkChild: any) => linkChild.text || '').join('');
              }
              return '';
            })
            .join('')
            .trim();
        }
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

// Helper function to extract content with link structure preserved
function extractContentWithLinks(content: string | any[]): ContentSegment[] {
  if (!content) return [];

  let parsed: any[] | null = null;

  if (Array.isArray(content)) {
    parsed = content;
  } else if (typeof content === 'string') {
    try {
      const result = JSON.parse(content);
      if (Array.isArray(result)) {
        parsed = result;
      }
    } catch {
      // If not JSON, treat as plain text
      return [{ type: 'text', text: stripHtml(content) }];
    }
  }

  if (!parsed || !Array.isArray(parsed)) return [];

  const segments: ContentSegment[] = [];

  for (const node of parsed) {
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'link' && child.children) {
          // Extract link text
          const linkText = child.children.map((linkChild: any) => linkChild.text || '').join('');
          if (linkText) {
            segments.push({ type: 'link', text: linkText });
          }
        } else if (child.text) {
          // Regular text - merge with previous text segment if possible
          const lastSegment = segments[segments.length - 1];
          if (lastSegment && lastSegment.type === 'text') {
            lastSegment.text += child.text;
          } else {
            segments.push({ type: 'text', text: child.text });
          }
        }
      }
      // Add space between paragraphs
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment.type === 'text') {
          lastSegment.text += ' ';
        } else {
          segments.push({ type: 'text', text: ' ' });
        }
      }
    }
  }

  return segments;
}

/**
 * Page data type for OG images - minimal subset for image generation
 */
interface OGPageData {
  title?: string;
  content?: string | any[];
  username?: string;
  authorUsername?: string;
  sponsorCount?: number;
}

async function fetchPageData(pageId: string): Promise<OGPageData | null> {
  try {
    // Use Firebase Admin SDK for direct database access
    // This bypasses security rules and doesn't require authentication
    const db = getAdminFirestore();
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();

    if (!pageDoc.exists) {
      console.warn(`Page ${pageId} not found for OG image`);
      return null;
    }

    const data = pageDoc.data();
    if (!data) {
      return null;
    }

    return {
      title: data.title,
      content: data.content,
      username: data.username,
      authorUsername: data.authorUsername,
    };
  } catch (error) {
    console.warn(`Error fetching page data for OG image ${pageId}:`, error);
    return null;
  }
}

async function fetchSponsorCount(pageId: string): Promise<number> {
  try {
    // Use Firebase Admin SDK for direct database access
    const db = getAdminFirestore();
    const pledgesSnapshot = await db.collection(getCollectionName('pages')).doc(pageId).collection('pledges').get();
    return pledgesSnapshot.size;
  } catch {
    return 0;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch page data
  const [pageData, sponsorCount] = await Promise.all([
    fetchPageData(id),
    fetchSponsorCount(id)
  ]);

  // If no page data, return default WeWrite branding
  if (!pageData) {
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
              fontWeight: 'bold',
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
            The social wiki where every page is a fundraiser
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // Extract display values
  const displayTitle = pageData.title || 'Untitled Page';
  const displayAuthor = pageData.authorUsername || pageData.username || 'WeWrite User';
  const displayContent = pageData.content || '';
  const displaySponsorCount = sponsorCount;

  // Process content to get segments with links preserved
  const contentSegments = extractContentWithLinks(displayContent);

  // If no content, use fallback
  const hasMeaningfulContent = contentSegments.length > 0 &&
    contentSegments.some(s => s.text.trim().length > 0);

  // Truncate content segments to ~500 chars total while preserving link structure
  let charCount = 0;
  const maxChars = 500;
  const truncatedSegments: ContentSegment[] = [];

  if (hasMeaningfulContent) {
    for (const segment of contentSegments) {
      if (charCount >= maxChars) break;

      const remainingChars = maxChars - charCount;
      if (segment.text.length <= remainingChars) {
        truncatedSegments.push(segment);
        charCount += segment.text.length;
      } else {
        // Truncate this segment
        truncatedSegments.push({
          type: segment.type,
          text: segment.text.substring(0, remainingChars)
        });
        charCount = maxChars;
        break;
      }
    }
  } else {
    truncatedSegments.push({ type: 'text', text: 'Discover this page on WeWrite' });
  }

  // Truncate title
  let displayTitleFormatted = displayTitle.substring(0, 70);
  if (displayTitle.length > 70) {
    displayTitleFormatted = displayTitle.substring(0, 67) + '...';
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
          padding: '50px 60px 0 60px',
          fontFamily: 'system-ui',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Title */}
        <div style={{
          display: 'flex',
          fontSize: 72,
          fontWeight: 'bold',
          marginBottom: '30px',
          lineHeight: '1.2',
          maxHeight: '259px',
          overflow: 'hidden'
        }}>
          {displayTitleFormatted}
        </div>

        {/* Body content with styled links */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          fontSize: 28,
          marginBottom: '0px',
          color: 'rgba(255, 255, 255, 0.9)',
          lineHeight: '1.6',
          flex: 1,
          position: 'relative',
          alignContent: 'flex-start'
        }}>
          {truncatedSegments.map((segment, index) => (
            segment.type === 'link' ? (
              <span
                key={index}
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  color: '#93C5FD',
                  padding: '2px 10px',
                  borderRadius: '6px',
                  marginLeft: '2px',
                  marginRight: '2px',
                  display: 'inline',
                }}
              >
                {segment.text}
              </span>
            ) : (
              <span key={index}>{segment.text}</span>
            )
          ))}
        </div>

        {/* Gradient fade above footer */}
        <div style={{
          position: 'absolute',
          bottom: '120px',
          left: '0px',
          right: '0px',
          height: '120px',
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

          {/* Author button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 31,
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.9)',
            backgroundColor: 'rgba(75, 85, 99, 0.6)',
            padding: '0px 35px',
            borderRadius: '50px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            whiteSpace: 'nowrap',
            height: '70px',
            boxSizing: 'border-box'
          }}>
            by {displayAuthor}
          </div>

          {/* Sponsors button */}
          {displaySponsorCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 31,
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.9)',
              backgroundColor: 'rgba(75, 85, 99, 0.6)',
              padding: '0px 35px',
              borderRadius: '50px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              whiteSpace: 'nowrap',
              height: '70px',
              boxSizing: 'border-box'
            }}>
              {displaySponsorCount} Sponsors
            </div>
          )}

          {/* Keep reading button */}
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
            Keep reading →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
