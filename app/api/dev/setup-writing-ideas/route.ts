import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { writingIdeas as defaultWritingIdeas } from '../../../data/writingIdeas';

/**
 * DEV ONLY: Setup writing ideas in development environment
 * This creates the initial writing ideas document in the DEV_admin_settings collection
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up writing ideas for development...');
    
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    
    const db = admin.firestore();
    const collectionName = getCollectionName(COLLECTIONS.ADMIN_SETTINGS);
    console.log(`📝 Using collection: ${collectionName}`);
    
    const docRef = db.collection(collectionName).doc('writing_ideas');
    
    // Check if document already exists
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      console.log('📝 Writing ideas document already exists');
      return NextResponse.json({
        success: true,
        message: 'Writing ideas document already exists',
        collection: collectionName,
        existingIdeas: existingDoc.data()?.ideas?.length || 0
      });
    }
    
    // Create the document with default writing ideas
    const writingIdeasDocument = {
      ideas: defaultWritingIdeas.map((idea, index) => ({
        ...idea,
        id: `idea_${Date.now()}_${index}`,
        isNew: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      lastUpdated: new Date().toISOString(),
      version: 1
    };
    
    await docRef.set(writingIdeasDocument);
    
    console.log(`✅ Created writing ideas document with ${defaultWritingIdeas.length} ideas`);
    
    return NextResponse.json({
      success: true,
      message: `Created writing ideas document with ${defaultWritingIdeas.length} ideas`,
      collection: collectionName,
      ideasCount: defaultWritingIdeas.length,
      document: writingIdeasDocument
    });
    
  } catch (error) {
    console.error('❌ Error setting up writing ideas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to setup writing ideas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
