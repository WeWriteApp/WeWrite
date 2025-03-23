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
    
    // Extract text content from page content
    let contentText = '';
    try {
      if (page.content) {
        contentText = extractTextContent(page.content);
        // Limit the content text to a reasonable length
        contentText = contentText.substring(0, 200) + (contentText.length > 200 ? '...' : '');
      }
    } catch (error) {
      console.error('Error extracting text content:', error);
      contentText = 'No content available';
    }

    // Get page title and author
    const title = page.title || 'Untitled Page';
    const author = page.username || 'Anonymous';

    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: 'black',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '50px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 60,
              fontStyle: 'normal',
              color: 'white',
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              marginBottom: '20px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              fontStyle: 'normal',
              color: 'white',
              opacity: 0.8,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              marginBottom: '40px',
              maxWidth: '800px',
            }}
          >
            {contentText}
          </div>
          <div
            style={{
              fontSize: 24,
              fontStyle: 'normal',
              color: 'white',
              opacity: 0.6,
              marginTop: 'auto',
            }}
          >
            By {author} • WeWrite
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
