import { ImageResponse } from 'next/og';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { extractTextContent } from '../../utils/generateTextDiff';

// Force nodejs runtime which is more stable for image generation
export const runtime = 'nodejs';

// Disable edge runtime which may cause issues
export const preferredRegion = 'home';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get the page ID from the request
    const pageId = searchParams.get('id');
    
    console.log(`OG Image request for pageId: ${pageId}`);
    
    if (!pageId) {
      console.log('No pageId provided');
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
    console.log(`Fetching page data for ID: ${pageId}`);
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);
    
    if (!pageDoc.exists()) {
      console.log(`Page not found for ID: ${pageId}`);
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
    console.log(`Page data retrieved, title: ${page.title}`);
    
    // Extract text content from page content
    let contentText = '';
    let links = [];
    
    try {
      if (page.content) {
        contentText = extractTextContent(page.content);
        console.log(`Extracted text content: ${contentText.substring(0, 50)}...`);
        
        // Attempt to extract links from the content
        try {
          const contentObj = typeof page.content === 'string' ? JSON.parse(page.content) : page.content;
          
          // Simple function to extract links from content
          const extractLinks = (node) => {
            if (node.type === 'link' && node.url) {
              links.push(node.url);
            }
            if (node.children) {
              node.children.forEach(extractLinks);
            }
          };
          
          if (Array.isArray(contentObj)) {
            contentObj.forEach(extractLinks);
          }
          
          if (links.length > 0) {
            console.log(`Found ${links.length} links in content`);
          }
        } catch (linkError) {
          console.error('Error extracting links:', linkError);
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

    // Format content text with | for newlines and wrap links in quotes
    // Add 3 spaces before and after pipe symbols
    let formattedContent = contentText
      // Replace newlines with pipe symbol with spaces
      .replace(/\n+/g, '   |   ')
      // Ensure consistent spacing
      .replace(/\s+/g, ' ')
      .trim();
      
    // Truncate if too long
    if (formattedContent.length > 280) {
      formattedContent = formattedContent.substring(0, 277) + '...';
    }
    
    // Split content by spaces to process words
    const words = formattedContent.split(' ');
    
    // Process words to wrap links in quotes and handle | symbols
    const processedWords = words.map(word => {
      // If it's a pipe symbol for newline, return as is
      if (word === '|') {
        return word;
      }
      
      // Check if word is likely a link
      const isLikelyLink = 
        word.startsWith('http') || 
        word.includes('.com') || 
        word.includes('.org') || 
        word.includes('.net') ||
        word.includes('.io') ||
        word.includes('@');
      
      // Known links from content
      const isKnownLink = links.some(link => word.includes(link));
      
      if (isLikelyLink || isKnownLink) {
        return `"${word}"`;
      }
      
      return word;
    });
    
    // Join words back together
    const displayContent = processedWords.join(' ');
    console.log(`Formatted display content: ${displayContent.substring(0, 50)}...`);

    // Simplified image to reduce any potential rendering issues
    console.log(`Generating image response with dimensions 1200x630`);
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: 'black',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px',
            color: 'white',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              width: '100%',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                fontSize: 60,
                fontWeight: 'bold',
                color: 'white',
                maxWidth: '70%',
              }}
            >
              {title}
            </div>
            <div
              style={{
                padding: '10px 20px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontSize: 20,
              }}
            >
              By {author}
            </div>
          </div>
          
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.5,
              color: 'white',
              maxWidth: '90%',
            }}
          >
            {displayContent.split(' ').map((part, i) => {
              if (part === '|') {
                return <br key={`br-${i}`} />;
              }
              
              const isQuoted = part.startsWith('"') && part.endsWith('"');
              
              return (
                <span
                  key={i}
                  style={{
                    color: isQuoted ? '#4285f4' : 'white',
                    backgroundColor: isQuoted ? 'rgba(66, 133, 244, 0.1)' : 'transparent',
                    padding: isQuoted ? '2px 5px' : '0',
                    borderRadius: isQuoted ? '4px' : '0',
                    marginRight: '5px',
                  }}
                >
                  {isQuoted ? part.substring(1, part.length - 1) : part}
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
      },
    );
  } catch (e) {
    console.error(`OG image generation error: ${e.message}`, e);
    return new Response(`Failed to generate OG image: ${e.message}`, { status: 500 });
  }
}
