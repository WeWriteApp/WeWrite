import { ImageResponse } from 'next/og';

// Set Edge runtime
export const runtime = 'edge';

// Helper function to strip HTML and get plain text
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .trim();
}

// Helper function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// Helper function to fetch page data
async function fetchPageData(pageId: string) {
  try {
    // Get base URL with proper fallbacks for different environments
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   (process.env.NODE_ENV === 'production' ? 'https://wewrite.app' : 'http://localhost:3000'));
    const response = await fetch(`${baseUrl}/api/pages/${pageId}`, {
      headers: {
        'User-Agent': 'WeWrite-OG-Generator/1.0'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`Failed to fetch page data for ${pageId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`📄 [OG] Fetched page data for ${pageId}:`, {
      title: data.title,
      author: data.authorUsername || data.username,
      contentLength: data.content?.length || 0
    });

    return data;
  } catch (error) {
    console.warn(`Error fetching page data for ${pageId}:`, error);
    return null;
  }
}

// Helper function to fetch sponsor count
async function fetchSponsorCount(pageId: string) {
  try {
    // Get base URL with proper fallbacks for different environments
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   (process.env.NODE_ENV === 'production' ? 'https://wewrite.app' : 'http://localhost:3000'));
    const response = await fetch(`${baseUrl}/api/pages/${pageId}/sponsors`, {
      headers: {
        'User-Agent': 'WeWrite-OG-Generator/1.0'
      }
    });

    if (!response.ok) {
      return 0; // Default to 0 sponsors if API fails
    }

    const data = await response.json();
    return data.sponsorCount || 0;
  } catch (error) {
    console.warn(`Error fetching sponsor count for ${pageId}:`, error);
    return 0;
  }
}

// Set the content type and cache headers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get parameters from the request
    const pageId = searchParams.get('id');
    const type = searchParams.get('type') || 'page';
    const title = searchParams.get('title');
    const author = searchParams.get('author');
    const content = searchParams.get('content');
    const sponsors = searchParams.get('sponsors');

    console.log('🖼️ [OG] Generating image for:', {
      pageId,
      type,
      hasTitle: !!title,
      hasAuthor: !!author,
      hasContent: !!content,
      sponsors
    });

    if (!pageId) {
      console.log('🖼️ [OG] No pageId provided, returning default WeWrite image');
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
            <div
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: 'white',
                padding: '16px 40px',
                borderRadius: '50px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              Start writing today →
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'content-type': 'image/png',
            'cache-control': 'public, immutable, no-transform, max-age=31536000'
          }
        }
      );
    }

    // Fetch real page data if pageId is provided and no manual data is passed
    let pageData = null;
    let sponsorCount = 0;

    if (pageId && !title && !author && !content) {
      // Fetch real data from the API
      pageData = await fetchPageData(pageId);
      sponsorCount = await fetchSponsorCount(pageId);
    }

    // Generate dynamic content based on type and parameters
    let displayTitle = title || pageData?.title || `Content ${pageId.substring(0, 8)}...`;
    let displayAuthor = author || pageData?.authorUsername || pageData?.username || 'WeWrite User';
    let displayContent = content || pageData?.content || '';
    let displaySponsorCount = sponsors ? parseInt(sponsors) : sponsorCount;
    let typeLabel = '';

    switch (type) {
      case 'user':
        typeLabel = 'Profile';
        displayTitle = title || `User Profile`;
        displayAuthor = author || displayTitle;
        break;
      default:
        typeLabel = 'Page';
        displayTitle = displayTitle || `Page ${pageId.substring(0, 8)}...`;
    }

    // Process content for display
    const plainTextContent = stripHtml(displayContent);
    const truncatedContent = truncateText(plainTextContent, 280); // Limit content length

    // Split content into lines for better display
    const contentLines = truncatedContent.split('\n').filter(line => line.trim().length > 0);
    const displayLines = contentLines.slice(0, 4); // Show max 4 lines

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: '#000000',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '60px 70px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative'
          }}
        >
          {/* Page Title */}
          <div
            style={{
              fontSize: displayTitle.length > 50 ? 56 : 72,
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.1,
              marginBottom: '40px',
              maxHeight: '160px',
              overflow: 'hidden'
            }}
          >
            {truncateText(displayTitle, 80)}
          </div>

          {/* Content Preview */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '20px',
              position: 'relative'
            }}
          >
            {displayLines.length > 0 ? (
              displayLines.map((line, index) => (
                <div
                  key={index}
                  style={{
                    fontSize: 32,
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: 1.4,
                    opacity: 1 - (index * 0.15) // Fade out lower lines
                  }}
                >
                  {truncateText(line, 100)}
                </div>
              ))
            ) : (
              <div
                style={{
                  fontSize: 32,
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: 1.4,
                  fontStyle: 'italic'
                }}
              >
                This page is ready for content...
              </div>
            )}

            {/* Gradient overlay for CTA */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '120px',
                background: 'linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0) 100%)'
              }}
            />
          </div>

          {/* Bottom section with author, sponsors, and CTA */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              zIndex: 10
            }}
          >
            {/* Author and Sponsors Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  color: 'rgba(255, 255, 255, 0.8)',
                  padding: '8px 20px',
                  borderRadius: '25px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                By {truncateText(displayAuthor, 25)}
              </div>

              <div
                style={{
                  fontSize: 24,
                  color: 'rgba(255, 255, 255, 0.8)',
                  padding: '8px 20px',
                  borderRadius: '25px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                {displaySponsorCount === 1 ? '1 sponsor' : `${displaySponsorCount} sponsors`}
              </div>
            </div>

            {/* CTA Button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: 'white',
                  padding: '16px 40px',
                  borderRadius: '50px',
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)'
                }}
              >
                Read more on WeWrite
                <div
                  style={{
                    fontSize: 24,
                    transform: 'translateX(4px)'
                  }}
                >
                  →
                </div>
              </div>
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
          'cache-control': 'public, immutable, no-transform, max-age=31536000'}});
  } catch (e) {
    console.error(e);
    return new Response('Failed to generate OG image', { 
      status: 500,
      headers: {
        'content-type': 'text/plain'}});
  }
}