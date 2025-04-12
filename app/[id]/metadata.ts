import { Metadata } from 'next';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
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
    console.error('Error generating metadata:', error);
  }

  // Truncate content for description
  const description = truncateText(content, 200);

  return {
    title: `${title} by ${username} on WeWrite`,
    description,
    openGraph: {
      title: `${title} by ${username} on WeWrite`,
      description,
      type: 'article',
      url: `https://wewrite.vercel.app/${id}`,
      images: [
        {
          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://wewrite.vercel.app'}/api/og/${id}`,
          width: 1200,
          height: 630,
          alt: `${title} by ${username}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} by ${username} on WeWrite`,
      description,
      images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'https://wewrite.vercel.app'}/api/og/${id}`],
    },
  };
}
