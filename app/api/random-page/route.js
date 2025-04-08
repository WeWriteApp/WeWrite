import { NextResponse } from 'next/server';
import { db } from '../../firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

/**
 * API route to get a random page
 *
 * @returns {Promise<NextResponse>} - Response with a random page ID
 */
export async function GET() {
  try {
    // Query for public pages
    const pagesRef = collection(db, 'pages');
    const publicPagesQuery = query(
      pagesRef,
      where('isPublic', '==', true),
      where('deleted', '==', false),
      limit(100) // Limit to 100 pages for performance
    );

    const snapshot = await getDocs(publicPagesQuery);

    if (snapshot.empty) {
      return NextResponse.json({ error: 'No pages found' }, { status: 404 });
    }

    // Convert to array
    const pages = [];
    snapshot.forEach(doc => {
      pages.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Select a random page
    const randomIndex = Math.floor(Math.random() * pages.length);
    const randomPage = pages[randomIndex];

    return NextResponse.json({
      pageId: randomPage.id,
      title: randomPage.title || 'Untitled'
    });
  } catch (error) {
    console.error('Error getting random page:', error);
    return NextResponse.json({ error: 'Failed to get random page' }, { status: 500 });
  }
}
