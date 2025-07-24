import { ImageResponse } from 'next/og';

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

export async function GET(request: Request) {
  console.log('🖼️ [OG] Route called with URL:', request.url);

  try {
    const { searchParams } = new URL(request.url);
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
      sponsors,
      url: request.url
    });

    // Test mode - simple red image for testing
    if (pageId === 'test') {
      console.log('🖼️ [OG] Test mode');
      return new ImageResponse(
        (
          <div
            style={{
              backgroundColor: '#ff0000',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{ color: 'white', fontSize: 48 }}>
              MINIMAL TEST WORKING
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        }
      );
    }

    // Default WeWrite branding if no pageId
    if (!pageId) {
      console.log('🖼️ [OG] Default WeWrite branding');
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
                alignItems: 'center'
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
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        }
      );
    }

    // Fetch real page data if pageId is provided and no manual data is passed
    let pageData = null;
    let sponsorCount = 0;

    if (pageId && !title && !author && !content) {
      console.log('🖼️ [OG] Fetching real data for pageId:', pageId);
      pageData = await fetchPageData(pageId);
      sponsorCount = await fetchSponsorCount(pageId);
    }

    // Generate dynamic content based on parameters or fetched data
    const displayTitle = title || pageData?.title || 'Untitled Page';
    const displayAuthor = author || pageData?.authorUsername || pageData?.username || 'WeWrite User';
    const displayContent = content || pageData?.content || '';
    const displaySponsorCount = sponsors ? parseInt(sponsors) : sponsorCount;

    // Process content to get a clean preview
    let contentPreview = '';
    if (displayContent) {
      try {
        // Try to parse as JSON first (rich content)
        const parsedContent = JSON.parse(displayContent);
        if (Array.isArray(parsedContent)) {
          // Extract text from rich content structure
          contentPreview = parsedContent
            .map(node => {
              if (node.children) {
                return node.children
                  .map(child => {
                    // Handle both text nodes and link nodes
                    if (child.text) {
                      return child.text;
                    } else if (child.type === 'link' && child.children) {
                      return child.children.map(linkChild => linkChild.text || '').join('');
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
      } catch {
        // If not JSON, treat as plain text/HTML
        contentPreview = stripHtml(displayContent);
      }
    }

    // Truncate content for display
    contentPreview = truncateText(contentPreview, 300);

    console.log('🖼️ [OG] Generating image with data:', {
      displayTitle: truncateText(displayTitle, 50),
      displayAuthor,
      contentLength: contentPreview.length,
      displaySponsorCount
    });

    // Generate the dynamic OpenGraph image
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: '#000000',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '60px'
          }}
        >
          {/* Header with sponsor count and WeWrite logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '40px'
            }}
          >
            {displaySponsorCount > 0 ? (
              <div
                style={{
                  fontSize: 20,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                {displaySponsorCount} {displaySponsorCount === 1 ? 'sponsor' : 'sponsors'}
              </div>
            ) : (
              <div></div>
            )}
            <div
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: 'white'
              }}
            >
              WeWrite
            </div>
          </div>

          {/* Main content area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            {/* Page title */}
            <div
              style={{
                fontSize: 56,
                fontWeight: 'bold',
                color: 'white',
                lineHeight: 1.2,
                marginBottom: '24px'
              }}
            >
              {truncateText(displayTitle, 80)}
            </div>

            {/* Content preview */}
            {contentPreview && (
              <div
                style={{
                  fontSize: 28,
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.4,
                  marginBottom: '32px'
                }}
              >
                {contentPreview}
              </div>
            )}

            {/* Author info - no avatar */}
            <div
              style={{
                fontSize: 22,
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            >
              by {displayAuthor}
            </div>
          </div>

          {/* Footer with call to action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '40px'
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: 'rgba(255, 255, 255, 0.6)'
              }}
            >
              The social wiki where every page is a fundraiser
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: 'white',
                padding: '20px 48px',
                borderRadius: '50px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)'
              }}
            >
              Read & Support →
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      }
    );
  } catch (error) {
    console.error('🖼️ [OG] Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
