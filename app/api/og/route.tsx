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
              backgroundSize: '150px 150px',
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

    // Get page title and author
    const title = page.title || 'Untitled Page';
    const author = page.username || 'Anonymous';
    const sponsorCount = page.sponsors?.length || 0;

    // Process content to extract text and identify links
    let contentWithLinks = '';
    try {
      if (page.content) {
        // For simplicity in the OG image, we'll create a mock representation
        // of the content with links highlighted
        contentWithLinks = extractContentWithLinks(page.content);
      }
    } catch (error) {
      console.error('Error extracting content with links:', error);
      contentWithLinks = 'No content available';
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
            padding: '60px 70px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Page Title */}
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.2,
              marginBottom: '40px',
            }}
          >
            {title}
          </div>

          {/* Page Content with Links */}
          <div
            style={{
              fontSize: 36,
              color: 'white',
              lineHeight: 1.5,
              marginBottom: '30px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
            dangerouslySetInnerHTML={{ __html: contentWithLinks }}
          />

          {/* Author and Sponsors */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: 'white',
                opacity: 0.8,
                padding: '10px 25px',
                borderRadius: '40px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              By {author}
            </div>

            <div
              style={{
                fontSize: 28,
                color: 'white',
                opacity: 0.8,
                padding: '10px 25px',
                borderRadius: '40px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {sponsorCount} {sponsorCount === 1 ? 'sponsor' : 'sponsors'}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e) {
    console.error(e);
    return new Response('Failed to generate OG image', { status: 500 });
  }
}

// Helper function to extract content with links highlighted
function extractContentWithLinks(content) {
  try {
    if (!content) return 'No content available';
    
    // Parse the content if it's a string
    let parsedContent;
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        return content.substring(0, 300) + (content.length > 300 ? '...' : '');
      }
    } else {
      parsedContent = content;
    }
    
    // If content is not an array (which Slate content should be), return a simple string
    if (!Array.isArray(parsedContent)) {
      return 'Content format not recognized';
    }
    
    // Process the Slate nodes to extract text and identify links
    let htmlContent = '';
    let wordCount = 0;
    const MAX_WORDS = 50; // Limit the number of words to display
    
    // Function to process a node and its children
    const processNode = (node) => {
      if (wordCount >= MAX_WORDS) return;
      
      // Handle text nodes
      if (node.text) {
        // Check if this text node has link marks
        const isLink = node.url || (node.marks && node.marks.some(mark => mark.type === 'link'));
        
        if (isLink) {
          // This is a link text, style it accordingly
          htmlContent += `<span style="color: #3b82f6; background-color: #3b82f6; padding: 5px 15px; border-radius: 20px; color: white;">${node.text}</span>`;
        } else {
          // Regular text
          htmlContent += node.text;
        }
        
        // Count words in this text node
        wordCount += node.text.split(/\s+/).filter(Boolean).length;
        return;
      }
      
      // Handle element nodes with children
      if (node.children && Array.isArray(node.children)) {
        // Special handling for link elements
        if (node.type === 'link' || node.url) {
          htmlContent += `<span style="color: #3b82f6; background-color: #3b82f6; padding: 5px 15px; border-radius: 20px; color: white;">`;
          node.children.forEach(child => processNode(child));
          htmlContent += `</span>`;
        } else {
          // Process children for other element types
          node.children.forEach(child => processNode(child));
          
          // Add appropriate spacing after block elements
          if (['paragraph', 'heading'].includes(node.type)) {
            htmlContent += ' ';
          }
        }
      }
    };
    
    // Process each top-level node
    for (const node of parsedContent) {
      processNode(node);
      if (wordCount >= MAX_WORDS) {
        htmlContent += '...';
        break;
      }
    }
    
    return htmlContent || 'No content available';
  } catch (error) {
    console.error('Error in extractContentWithLinks:', error);
    return 'Error processing content';
  }
}
