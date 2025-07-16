import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    console.log('🔍 Creating test pages in dev environment...');
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const testPages = [
      {
        id: 'test-page-who',
        title: 'who',
        content: JSON.stringify([
          { type: 'heading', level: 1, children: [{ text: 'Who' }] },
          { type: 'paragraph', children: [{ text: 'This is a test page about who we are.' }] }
        ]),
        userId: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // testuser1 UID
        username: 'testuser1'
      },
      {
        id: 'test-page-about',
        title: 'about',
        content: JSON.stringify([
          { type: 'heading', level: 1, children: [{ text: 'About' }] },
          { type: 'paragraph', children: [{ text: 'This is a test page about our mission.' }] }
        ]),
        userId: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // testuser1 UID
        username: 'testuser1'
      },
      {
        id: 'test-page-getting-started',
        title: 'Getting Started with WeWrite',
        content: JSON.stringify([
          { type: 'heading', level: 1, children: [{ text: 'Getting Started with WeWrite' }] },
          { type: 'paragraph', children: [{ text: 'This is a comprehensive guide to getting started with WeWrite.' }] }
        ]),
        userId: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // testuser1 UID
        username: 'testuser1'
      }
    ];
    
    const results = [];
    const pagesCollectionName = getCollectionName('pages');
    
    for (const page of testPages) {
      try {
        const pageData = {
          ...page,
          isPublic: true,
          createdAt: admin.firestore.Timestamp.now(),
          lastModified: admin.firestore.Timestamp.now(),
          deleted: false,
          stats: {
            views: 0,
            likes: 0,
            comments: 0
          }
        };
        
        await db.collection(pagesCollectionName).doc(page.id).set(pageData);
        console.log(`✅ Created test page: ${page.title}`);
        results.push(page.title);
        
      } catch (error) {
        console.error(`❌ Failed to create page ${page.title}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${results.length} test pages`,
      pages: results,
      collection: pagesCollectionName
    });
    
  } catch (error) {
    console.error('❌ Error creating test pages:', error);
    return NextResponse.json({
      error: 'Failed to create test pages',
      details: error.message
    }, { status: 500 });
  }
}
