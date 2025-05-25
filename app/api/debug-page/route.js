import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId') || '8RHcSjstGXzAK16U6qvO';
    
    console.log(`🔍 DEBUG: Checking page ${pageId}`);
    
    // Import Firestore modules
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');
    
    // Get the specific page
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);
    
    if (!pageDoc.exists()) {
      return NextResponse.json({
        error: 'Page not found',
        pageId: pageId
      }, { status: 404 });
    }
    
    const pageData = pageDoc.data();
    
    // Test search matching
    const title = pageData.title || 'Untitled';
    const normalizedTitle = title.toLowerCase();
    const searchTerm = 'patriot';
    const matches = normalizedTitle.includes(searchTerm);
    
    const result = {
      pageId: pageId,
      title: title,
      isPublic: pageData.isPublic,
      userId: pageData.userId,
      username: pageData.username,
      lastModified: pageData.lastModified,
      createdAt: pageData.createdAt,
      searchTest: {
        searchTerm: searchTerm,
        normalizedTitle: normalizedTitle,
        matches: matches,
        explanation: matches ? 'Should appear in search results' : 'Will not appear in search results'
      }
    };
    
    console.log(`🔍 DEBUG RESULT:`, result);
    
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    console.error('Error in debug page API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}
