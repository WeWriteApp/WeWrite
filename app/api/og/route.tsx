import { ImageResponse } from 'next/og';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { extractTextContent } from '../../utils/generateTextDiff';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get the page ID from the request
    const pageId = searchParams.get('id');
    
    if (!pageId) {
      return new ImageResponse(
        (
          <div
            style={{
              backgroundColor: 'black',
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
        },
      );
    }

    // Fetch page data from Firestore
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);
    
    if (!pageDoc.exists()) {
      return new ImageResponse(
        (
          <div
            style={{
              backgroundColor: 'black',
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
                Page not found
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
              WeWrite
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        },
      );
    }

    const page = pageDoc.data();
    
    // Extract text content from page content
    let contentText = '';
    let contentHtml = '';
    try {
      if (page.content) {
        contentText = extractTextContent(page.content);
        
        // Attempt to identify any links in the content for highlighting
        const contentObj = typeof page.content === 'string' ? JSON.parse(page.content) : page.content;
        
        // Find nodes that might contain links
        const links = [];
        const processNode = (node) => {
          if (node.type === 'link' || (node.url && node.text)) {
            links.push(node);
          }
          if (node.children) {
            node.children.forEach(processNode);
          }
        };
        
        if (Array.isArray(contentObj)) {
          contentObj.forEach(processNode);
        }
      }
    } catch (error) {
      console.error('Error extracting text content:', error);
      contentText = 'No content available';
    }

    // Get page title and author
    const title = page.title || 'Untitled Page';
    const author = page.username || 'Anonymous';
    
    // Get pledge count if available
    const pledgeCount = page.pledgeCount || 0;
    const sponsorText = pledgeCount === 1 ? '1 sponsor' : `${pledgeCount} sponsors`;

    // Process content text to highlight links (simplified)
    // In reality, this is complex without proper parsing
    // For now, we'll just format the text
    let displayContent = contentText;
    if (displayContent.length > 280) {
      displayContent = displayContent.substring(0, 277) + '...';
    }

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: 'black',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '50px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: 'white',
                maxWidth: '70%',
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '16px',
              }}
            >
              <div
                style={{
                  padding: '10px 20px',
                  borderRadius: '50px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: 20,
                }}
              >
                By {author}
              </div>
              {pledgeCount > 0 && (
                <div
                  style={{
                    padding: '10px 20px',
                    borderRadius: '50px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    fontSize: 20,
                  }}
                >
                  {sponsorText}
                </div>
              )}
            </div>
          </div>
          
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.5,
              color: 'white',
              maxWidth: '90%',
            }}
          >
            {displayContent.split(' ').map((word, i) => {
              // This is a very simplistic way to "highlight" words that might be links
              // In a real implementation, we'd need proper parsing of Slate nodes
              const isLikelyLink = word.startsWith('http') || 
                                 word.includes('.com') || 
                                 word.includes('.org') ||
                                 word.includes('@');
              
              return (
                <span
                  key={i}
                  style={{
                    color: isLikelyLink ? '#4285f4' : 'white',
                    backgroundColor: isLikelyLink ? 'rgba(66, 133, 244, 0.1)' : 'transparent',
                    padding: isLikelyLink ? '2px 8px' : '0',
                    borderRadius: isLikelyLink ? '4px' : '0',
                    marginRight: '8px',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
          
          <div
            style={{
              fontSize: 16,
              color: 'white',
              opacity: 0.6,
              marginTop: 'auto',
              paddingTop: '20px',
            }}
          >
            WeWrite • Write together
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Inter',
            data: await fetch(
              new URL('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap', import.meta.url)
            ).then((res) => res.arrayBuffer()),
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Inter',
            data: await fetch(
              new URL('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap', import.meta.url)
            ).then((res) => res.arrayBuffer()),
            weight: 700,
            style: 'normal',
          },
        ],
      },
    );
  } catch (e) {
    console.error(e);
    return new Response('Failed to generate OG image', { status: 500 });
  }
}
