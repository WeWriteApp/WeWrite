"use client";
import { FirebaseMCP } from 'firebase-mcp';

// This function attempts to create the required Firestore index for username history
// It requires a service account key with appropriate permissions
export async function createUsernameHistoryIndex() {
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      console.log('Creating Firestore index can only be done in a server environment');
      return {
        success: false,
        message: 'Index creation must be done in a server environment with appropriate credentials'
      };
    }
    
    // Initialize the Firebase MCP
    const mcp = new FirebaseMCP({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      // This would need to be securely stored and accessed
      // keyFilename is not included here as it should not be exposed in client code
    });
    
    // Create the composite index for username history
    await mcp.createIndex({
      collectionGroup: 'usernameHistory',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'userId',
          order: 'ASCENDING'
        },
        {
          fieldPath: 'changedAt',
          order: 'DESCENDING'
        }
      ]
    });
    
    return {
      success: true,
      message: 'Successfully created Firestore index for username history'
    };
  } catch (error) {
    console.error('Error creating Firestore index:', error);
    return {
      success: false,
      message: `Failed to create index: ${error.message}`
    };
  }
}
