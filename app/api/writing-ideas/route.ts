import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { writingIdeas as defaultWritingIdeas, type WritingIdea } from '../../data/writingIdeas';
import { getCollectionName, COLLECTIONS } from '../../utils/environmentConfig';

const DOCUMENT_ID = 'writing_ideas';

interface StoredWritingIdea extends WritingIdea {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

interface WritingIdeasDocument {
  ideas: StoredWritingIdea[];
  lastUpdated: string;
  version: number;
}

/**
 * GET /api/writing-ideas
 * Public endpoint to retrieve writing ideas for use in components
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();
    const docRef = db.collection(getCollectionName(COLLECTIONS.ADMIN_SETTINGS)).doc(DOCUMENT_ID);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Initialize with default ideas and return them
      console.log('[Writing Ideas Public API] Document does not exist, initializing with default ideas');
      const defaultIdeas = defaultWritingIdeas.map((idea, index) => ({
        ...idea,
        id: `default_${index}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const initialData = {
        ideas: defaultIdeas,
        lastUpdated: new Date().toISOString(),
        version: 1
      };

      // Initialize the document for future admin use
      await docRef.set(initialData);
      console.log(`[Writing Ideas Public API] Initialized with ${defaultWritingIdeas.length} default ideas`);

      return NextResponse.json({
        success: true,
        data: {
          ideas: defaultWritingIdeas,
          total: defaultWritingIdeas.length,
          source: 'default_initialized'
        }
      });
    }

    const data = doc.data() as WritingIdeasDocument;
    
    // Convert stored ideas back to simple WritingIdea format for frontend
    const ideas: WritingIdea[] = (data.ideas || []).map(idea => ({
      title: idea.title,
      placeholder: idea.placeholder
    }));

    return NextResponse.json({
      success: true,
      data: {
        ideas,
        total: ideas.length,
        source: 'custom',
        lastUpdated: data.lastUpdated
      }
    });

  } catch (error) {
    console.error('Error fetching writing ideas:', error);
    
    // Fallback to default ideas on error
    return NextResponse.json({
      success: true,
      data: {
        ideas: defaultWritingIdeas,
        total: defaultWritingIdeas.length,
        source: 'default_fallback'
      }
    });
  }
}
