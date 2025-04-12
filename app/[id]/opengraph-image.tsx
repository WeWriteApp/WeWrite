import { ImageResponse } from 'next/og';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'WeWrite Page';
export const size = {
  width: 1200,
  height: 630,
};

// Function to extract plain text from Slate content
function extractPlainText(content: any): string {
  if (!content || !Array.isArray(content)) return '';
  
  return content.map(node => {
    if (node.text) return node.text;
    if (node.children) return extractPlainText(node.children);
    return '';
  }).join(' ');
}

// Function to truncate text with ellipsis
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export default async function Image({ params }: { params: { id: string } }) {
  const id = params.id;
  let title = 'Untitled';
  let content = '';
  let username = 'Anonymous';
  
  try {
    // Get page data from Firestore
    const pageDoc = await getDoc(doc(db, "pages", id));
    
    if (pageDoc.exists()) {
      const pageData = pageDoc.data();
      title = pageData.title || 'Untitled';
      
      // Get the user data to get the username
      if (pageData.userId) {
        const rtdb = getDatabase(app);
        const userRef = ref(rtdb, `users/${pageData.userId}`);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          username = userData.username || 'Anonymous';
        }
      }
      
      // Get the latest version content
      if (pageData.currentVersionId) {
        const versionDoc = await getDoc(doc(db, "versions", pageData.currentVersionId));
        if (versionDoc.exists()) {
          const versionData = versionDoc.data();
          if (versionData.content) {
            try {
              const contentData = typeof versionData.content === 'string' 
                ? JSON.parse(versionData.content) 
                : versionData.content;
              
              content = extractPlainText(contentData);
            } catch (error) {
              console.error('Error parsing content:', error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error generating OpenGraph image:', error);
  }
  
  // Truncate content for display
  const displayContent = truncateText(content, 200);
  
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 32,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: '60px',
          position: 'relative',
          color: 'white',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '16px',
            width: '100%',
            textAlign: 'left',
          }}
        >
          {title}
        </div>
        
        {/* Author */}
        <div
          style={{
            fontSize: '24px',
            marginBottom: '40px',
            opacity: 0.8,
          }}
        >
          by {username}
        </div>
        
        {/* Content with gradient fade */}
        <div
          style={{
            fontSize: '28px',
            lineHeight: 1.4,
            position: 'relative',
            height: '300px',
            width: '100%',
            overflow: 'hidden',
          }}
        >
          <div>{displayContent}</div>
          
          {/* Gradient overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '150px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))',
            }}
          />
        </div>
        
        {/* "Read more" text */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '60px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '24px',
          }}
        >
          Read more on WeWrite
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginLeft: '8px' }}
          >
            <path
              d="M5 12H19M19 12L12 5M19 12L12 19"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        
        {/* WeWrite logo/branding */}
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            fontSize: '24px',
            fontWeight: 'bold',
            opacity: 0.5,
          }}
        >
          WeWrite
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
