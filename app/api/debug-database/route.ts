import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Dynamic import to match the pattern used elsewhere
    const { db } = await import('../../firebase/database');
    const { collection, getDocs, query, limit } = await import('firebase/firestore');

    console.log('Debug Database: Starting database check...');

    // Try to get a few pages without any filters to see if there are ANY pages
    const simpleQuery = query(collection(db, 'pages'), limit(5));
    const snapshot = await getDocs(simpleQuery);
    
    console.log('Debug Database: Query executed, snapshot size:', snapshot.size);

    const pages: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      pages.push({
        id: doc.id,
        title: data.title || 'Untitled',
        isPublic: data.isPublic,
        deleted: data.deleted,
        userId: data.userId,
        createdAt: data.createdAt,
        lastModified: data.lastModified,
        // Include all fields to see what's actually in the database
        allFields: Object.keys(data),
        rawData: data
      });
    });

    console.log('Debug Database: Found pages:', pages.length);

    return NextResponse.json({
      success: true,
      totalPages: snapshot.size,
      pages: pages,
      message: `Found ${snapshot.size} pages in database`
    });

  } catch (error) {
    console.error('Debug Database: Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'unknown'
    }, { status: 500 });
  }
}
