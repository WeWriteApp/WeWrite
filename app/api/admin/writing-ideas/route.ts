import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { writingIdeas as defaultWritingIdeas, type WritingIdea } from '../../../data/writingIdeas';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

const DOCUMENT_ID = 'writing_ideas';

interface StoredWritingIdea extends WritingIdea {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  usageCount?: number;
  lastUsedAt?: string;
}

interface WritingIdeasDocument {
  ideas: StoredWritingIdea[];
  lastUpdated: string;
  version: number;
}

/**
 * GET /api/admin/writing-ideas
 * Retrieve all writing ideas
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    console.log('[Writing Ideas API] GET request received');

    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    console.log('[Writing Ideas API] Admin check result:', adminCheck);

    if (!adminCheck.success) {
      console.log('[Writing Ideas API] Access denied - not admin:', adminCheck.error);
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required', details: adminCheck.error },
        { status: 403 }
      );
    }

    console.log('[Writing Ideas API] Admin access granted for:', adminCheck.userEmail);

    console.log('[Writing Ideas API] Getting Firebase Admin instance');
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Writing Ideas API] Firebase Admin not initialized');
      throw new Error('Firebase Admin not initialized');
    }

    console.log('[Writing Ideas API] Getting Firestore database');
    const db = admin.firestore();
    const collectionName = getCollectionName(COLLECTIONS.ADMIN_SETTINGS);
    console.log(`[Writing Ideas API] Using collection: ${collectionName}`);
    const docRef = db.collection(collectionName).doc(DOCUMENT_ID);

    console.log('[Writing Ideas API] Fetching document from Firestore');
    const doc = await docRef.get();

    if (!doc.exists) {
      // Initialize with default ideas if document doesn't exist
      console.log('[Writing Ideas API] Document does not exist, initializing with default ideas');
      const defaultIdeas: StoredWritingIdea[] = defaultWritingIdeas.map((idea, index) => ({
        ...idea,
        id: `default_${index}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const initialData: WritingIdeasDocument = {
        ideas: defaultIdeas,
        lastUpdated: new Date().toISOString(),
        version: 1
      };

      console.log(`[Writing Ideas API] Initializing with ${defaultIdeas.length} default ideas`);
      await docRef.set(initialData);

      return NextResponse.json({
        success: true,
        data: {
          ideas: defaultIdeas,
          total: defaultIdeas.length
        }
      });
    }

    const data = doc.data() as WritingIdeasDocument;
    console.log(`[Writing Ideas API] Found existing document with ${data.ideas?.length || 0} ideas`);

    const response = {
      success: true,
      data: {
        ideas: data.ideas || [],
        total: data.ideas?.length || 0,
        lastUpdated: data.lastUpdated,
        version: data.version
      }
    };

    console.log('[Writing Ideas API] Returning response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('[Writing Ideas API] Error fetching writing ideas:', error);
    console.error('[Writing Ideas API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch writing ideas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    }
  }); // End withAdminContext
}

/**
 * POST /api/admin/writing-ideas
 * Add a new writing idea
 */
export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required', details: adminCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, placeholder } = body;

    if (!title?.trim() || !placeholder?.trim()) {
      return NextResponse.json(
        { error: 'Title and placeholder are required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();
    const collectionName = getCollectionName(COLLECTIONS.ADMIN_SETTINGS);
    const docRef = db.collection(collectionName).doc(DOCUMENT_ID);
    const doc = await docRef.get();

    let currentData: WritingIdeasDocument;
    
    if (!doc.exists) {
      // Initialize with default ideas if document doesn't exist
      const defaultIdeas: StoredWritingIdea[] = defaultWritingIdeas.map((idea, index) => ({
        ...idea,
        id: `default_${index}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      currentData = {
        ideas: defaultIdeas,
        lastUpdated: new Date().toISOString(),
        version: 1
      };
    } else {
      currentData = doc.data() as WritingIdeasDocument;
    }

    // Create new idea
    const newIdea: StoredWritingIdea = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      placeholder: placeholder.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to beginning of array
    const updatedData: WritingIdeasDocument = {
      ideas: [newIdea, ...currentData.ideas],
      lastUpdated: new Date().toISOString(),
      version: (currentData.version || 1) + 1
    };

    await docRef.set(updatedData);

    return NextResponse.json({
      success: true,
      data: {
        idea: newIdea,
        total: updatedData.ideas.length
      }
    });

    } catch (error) {
      console.error('Error adding writing idea:', error);
      return NextResponse.json(
        { error: 'Failed to add writing idea' },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}

/**
 * PUT /api/admin/writing-ideas
 * Update an existing writing idea
 */
export async function PUT(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required', details: adminCheck.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, title, placeholder } = body;

    if (!id || !title?.trim() || !placeholder?.trim()) {
      return NextResponse.json(
        { error: 'ID, title, and placeholder are required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();
    const collectionName = getCollectionName(COLLECTIONS.ADMIN_SETTINGS);
    const docRef = db.collection(collectionName).doc(DOCUMENT_ID);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Writing ideas document not found' },
        { status: 404 }
      );
    }

    const currentData = doc.data() as WritingIdeasDocument;
    const ideaIndex = currentData.ideas.findIndex(idea => idea.id === id);

    if (ideaIndex === -1) {
      return NextResponse.json(
        { error: 'Writing idea not found' },
        { status: 404 }
      );
    }

    // Update the idea
    currentData.ideas[ideaIndex] = {
      ...currentData.ideas[ideaIndex],
      title: title.trim(),
      placeholder: placeholder.trim(),
      updatedAt: new Date().toISOString()
    };

    const updatedData: WritingIdeasDocument = {
      ...currentData,
      lastUpdated: new Date().toISOString(),
      version: (currentData.version || 1) + 1
    };

    await docRef.set(updatedData);

    return NextResponse.json({
      success: true,
      data: {
        idea: currentData.ideas[ideaIndex],
        total: updatedData.ideas.length
      }
    });

    } catch (error) {
      console.error('Error updating writing idea:', error);
      return NextResponse.json(
        { error: 'Failed to update writing idea' },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}

/**
 * DELETE /api/admin/writing-ideas
 * Delete a writing idea
 */
export async function DELETE(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required', details: adminCheck.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();
    const collectionName = getCollectionName(COLLECTIONS.ADMIN_SETTINGS);
    const docRef = db.collection(collectionName).doc(DOCUMENT_ID);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Writing ideas document not found' },
        { status: 404 }
      );
    }

    const currentData = doc.data() as WritingIdeasDocument;
    const filteredIdeas = currentData.ideas.filter(idea => idea.id !== id);

    if (filteredIdeas.length === currentData.ideas.length) {
      return NextResponse.json(
        { error: 'Writing idea not found' },
        { status: 404 }
      );
    }

    const updatedData: WritingIdeasDocument = {
      ideas: filteredIdeas,
      lastUpdated: new Date().toISOString(),
      version: (currentData.version || 1) + 1
    };

    await docRef.set(updatedData);

    return NextResponse.json({
      success: true,
      data: {
        deletedId: id,
        total: updatedData.ideas.length
      }
    });

    } catch (error) {
      console.error('Error deleting writing idea:', error);
      return NextResponse.json(
        { error: 'Failed to delete writing idea' },
        { status: 500 }
      );
    }
  }); // End withAdminContext
}
