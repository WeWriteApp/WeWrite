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
                   (process.env.NODE_ENV === 'production' ? 'https://www.getwewrite.app' : 'http://localhost:3000'));

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
                   (process.env.NODE_ENV === 'production' ? 'https://www.getwewrite.app' : 'http://localhost:3000'));

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
  try {
    console.log('🖼️ [OG] Route handler started');
    
    const url = new URL(request.url);
    console.log('🖼️ [OG] URL created:', url.pathname + url.search);
    
    const searchParams = url.searchParams;
    console.log('🖼️ [OG] SearchParams created');
    
    const pageId = searchParams.get('id');
    console.log('🖼️ [OG] pageId:', pageId);
    
    const title = searchParams.get('title');
    console.log('🖼️ [OG] title:', title?.substring(0, 20));
    
    const author = searchParams.get('author');
    console.log('🖼️ [OG] author:', author);
    
    const content = searchParams.get('content');
    console.log('🖼️ [OG] content:', content?.substring(0, 20));
    
    const sponsors = searchParams.get('sponsors');
    console.log('🖼️ [OG] sponsors:', sponsors);

    console.log('🖼️ [OG] Parsed params:', {
      pageId,
      hasTitle: !!title,
      hasAuthor: !!author,
      hasContent: !!content,
      sponsors
    });

    // Default WeWrite branding if no pageId AND no title provided
    if (!pageId && !title) {
      console.log('🖼️ [OG] No pageId or title, returning default');
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
          height: 630
        }
      );
    }

    console.log('🖼️ [OG] pageId exists, continuing to generate dynamic image');

    // Fetch real page data when we have a pageId and no overrides
    let pageData = null;
    let sponsorCount = 0;

    if (pageId && !title && !author && !content) {
      console.log('🖼️ [OG] Fetching real data for pageId:', pageId);
      [pageData, sponsorCount] = await Promise.all([
        fetchPageData(pageId),
        fetchSponsorCount(pageId)
      ]);
    }

    // Generate dynamic content based on parameters or fetched data
    const displayTitle = title || pageData?.title || (pageId ? `Page: ${pageId.substring(0, 12)}...` : 'Untitled Page');
    const displayAuthor = author || pageData?.authorUsername || pageData?.username || 'WeWrite User';
    const displayContent = content || pageData?.content || 'This is a sample content preview for testing the OpenGraph image generation. The actual content will be fetched from the page data.';
    const displaySponsorCount = sponsors ? parseInt(sponsors) : sponsorCount;

    console.log('🖼️ [OG] Step 1: Variables created');

    // Process content to get a clean preview
    let contentPreview = '';
    try {
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
    } catch (e) {
      console.error('🖼️ [OG] Error processing content:', e);
      contentPreview = 'Content preview';
    }

    // Ensure contentPreview is not empty
    if (!contentPreview) {
      contentPreview = 'Discover this page on WeWrite';
    }

    console.log('🖼️ [OG] Step 2: Content processed:', { contentLength: contentPreview.length });

    // Don't truncate too aggressively - let it be longer and fade
    const longContent = contentPreview.substring(0, 500);

    console.log('🖼️ [OG] Step 3: Content ready, about to create JSX');

    // Truncate title to 3 lines (approximately 70 chars to be safe)
    let displayTitleFormatted = displayTitle.substring(0, 70);
    if (displayTitle.length > 70) {
      displayTitleFormatted = displayTitle.substring(0, 67) + '...';
    }

    // Build content with blue links inline
    const linkTerms = [
      'Khan Academy', 'Gradescope', 'Duolingo',
      'Patagonia', "Ben & Jerry's", 'B Lab',
      'King Arthur', 'fermentation', 'autolyse',
      'Bitcoin', 'Ethereum', 'Solana', 'Polygon',
      'smart contracts', 'DeFi', 'Hyperledger',
      'Ansel Adams', 'Henri Cartier-Bresson', 'Lightroom'
    ];

    // Build content with links - split and rejoin with styled spans
    const contentParts: any[] = [];
    let lastIndex = 0;
    let match;
    const regex = new RegExp(`\\b(${linkTerms.join('|')})\\b`, 'g');
    
    while ((match = regex.exec(longContent)) !== null) {
      if (match.index > lastIndex) {
        contentParts.push(longContent.substring(lastIndex, match.index));
      }
      contentParts.push({
        type: 'link',
        text: match[0]
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < longContent.length) {
      contentParts.push(longContent.substring(lastIndex));
    }

    console.log('🖼️ [OG] contentParts built:', { 
      partsLength: contentParts.length,
      firstFewParts: contentParts.slice(0, 3).map(p => ({ type: p.type, text: typeof p === 'string' ? p.substring(0, 20) : p.text?.substring(0, 20) }))
    });

    console.log('🖼️ [OG] About to generate JSX with contentParts:');
    contentParts.forEach((part, idx) => {
      if (idx < 5) {
        console.log(`  Part ${idx}:`, {
          type: part.type || 'text',
          length: typeof part === 'string' ? part.length : part.text?.length,
          preview: typeof part === 'string' ? part.substring(0, 30) : part.text?.substring(0, 30)
        });
      }
    });

    // Generate the dynamic OpenGraph image with gradient fade
    const imageJsx = (
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
        {/* Title with 3-line truncation */}
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
        
        {/* Body content with inline pill-style links */}
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
          {contentParts.map((part, i) =>
            part.type === 'link' ? (
              <span key={i} style={{
                backgroundColor: '#3B82F6',
                color: '#ffffff',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '16px',
                marginLeft: '3px',
                marginRight: '3px',
                fontSize: 26
              }}>
                {part.text}
              </span>
            ) : (
              <span key={i}>{typeof part === 'string' ? part : part.text}</span>
            )
          )}
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
        
        {/* Black footer bar with logo and increased padding */}
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
          {/* WeWrite Logo SVG */}
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

          {/* Author button with max border radius and equal height */}
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

          {/* Sponsors button with max border radius and equal height */}
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

          {/* Keep reading button with max border radius and equal height */}
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
    );

    console.log('🖼️ [OG] JSX created, about to return ImageResponse...');
    console.log('🖼️ [OG] displayTitle:', displayTitle.substring(0, 50));
    console.log('🖼️ [OG] longContent:', longContent.substring(0, 50));
    console.log('🖼️ [OG] displayAuthor:', displayAuthor);
    console.log('🖼️ [OG] contentParts count:', contentParts.length);
    
    try {
      console.log('🖼️ [OG] Creating ImageResponse with JSX...');
      const result = new ImageResponse(imageJsx, {
        width: 1200,
        height: 630
      });
      console.log('🖼️ [OG] ImageResponse created successfully');
      return result;
    } catch (innerError) {
      console.error('🖼️ [OG] ImageResponse creation error:', {
        message: innerError instanceof Error ? innerError.message : String(innerError),
        stack: innerError instanceof Error ? innerError.stack : undefined,
        error: innerError
      });
      return new Response(JSON.stringify({ 
        error: 'Failed to generate image',
        details: innerError instanceof Error ? innerError.message : String(innerError)
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('🖼️ [OG] Outer error generating image:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return new Response(JSON.stringify({
      error: 'Error generating image',
      details: error instanceof Error ? error.message : String(error)
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
