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
    console.log('Random page API called');

    // Query for public pages
    const pagesRef = collection(db, 'pages');
    const publicPagesQuery = query(
      pagesRef,
      where('isPublic', '==', true),
      where('deleted', '==', false),
      limit(100) // Limit to 100 pages for performance
    );

    console.log('Executing Firestore query for random page');
    const snapshot = await getDocs(publicPagesQuery);

    if (snapshot.empty) {
      console.error('No pages found in the database');
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

    console.log(`Found ${pages.length} pages for random selection`);

    if (pages.length === 0) {
      console.error('No valid pages found after filtering');
      return NextResponse.json({ error: 'No valid pages found' }, { status: 404 });
    }

    // Select a random page
    const randomIndex = Math.floor(Math.random() * pages.length);
    const randomPage = pages[randomIndex];

    console.log(`Selected random page: ${randomPage.id} - ${randomPage.title || 'Untitled'}`);

    return NextResponse.json({
      pageId: randomPage.id,
      title: randomPage.title || 'Untitled'
    });
  } catch (error) {
    console.error('Error getting random page:', error);
    return NextResponse.json({ error: 'Failed to get random page' }, { status: 500 });
  }
}
