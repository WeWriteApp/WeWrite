import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { UsdService } from '../../../services/usdService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface EnhancedUsdAllocation {
  id: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  usdCents: number;
  month: string;
  resourceType: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId: string;
}

/**
 * Server-side function to get username by ID
 * @param userId - The user ID to get the username for
 * @returns The username or "Missing username" if not found
 */
async function getUsernameByIdServer(userId: string): Promise<string> {
  if (!userId) {
    return "Missing username";
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

    if (!userDoc.exists) {
      return "Missing username";
    }

    const userData = userDoc.data();
    const username = userData?.username;

    // Check for valid username
    if (username &&
        username !== "Anonymous" &&
        username !== "Missing username" &&
        username.trim() !== "") {
      return username.trim();
    }

    return "Missing username";
  } catch (error) {
    console.error(`👤 [ALLOCATIONS API] Error fetching username for ${userId}:`, error);
    return "Missing username";
  }
}

/**
 * GET /api/usd/allocations
 * Get user's USD allocations with enhanced page details
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    // Get USD balance and allocations
    const balance = await UsdService.getUserUsdBalance(userId);
    const allocations = await UsdService.getUserUsdAllocations(userId);

    if (!balance) {
      return NextResponse.json({
        balance: null,
        allocations: [],
        summary: {
          totalUsdCents: 0,
          allocatedUsdCents: 0,
          availableUsdCents: 0,
          allocationCount: 0
        },
        message: 'No USD balance found. Subscribe to start allocating funds.'
      });
    }

    // Enhance allocations with page/user details
    const enhancedAllocations: EnhancedUsdAllocation[] = await Promise.all(
      allocations.map(async (allocation) => {
        try {
          // Handle different resource types
          const admin = getFirebaseAdmin();
          if (!admin) {
            throw new Error('Firebase Admin not initialized');
          }

          // Handle user allocations (check both resourceType and resourceId pattern)
          const isUserAllocation = allocation.resourceType === 'user' || allocation.resourceId.startsWith('user/');

          if (isUserAllocation) {
            const userId = allocation.resourceId.replace('user/', '');

            try {
              const authorUsername = await getUsernameByIdServer(userId);

              return {
                id: allocation.id,
                pageId: allocation.resourceId,
                pageTitle: `User: ${authorUsername}`,
                authorId: userId,
                authorUsername,
                usdCents: allocation.usdCents,
                month: allocation.month,
                resourceType: allocation.resourceType,
                resourceId: allocation.resourceId
              };
            } catch (usernameError) {
              console.error(`Error fetching username for user ${userId}:`, usernameError);
              return {
                id: allocation.id,
                pageId: allocation.resourceId,
                pageTitle: 'User allocation',
                authorId: userId,
                authorUsername: 'Unknown User',
                usdCents: allocation.usdCents,
                month: allocation.month,
                resourceType: allocation.resourceType,
                resourceId: allocation.resourceId
              };
            }
          }

          // Handle page allocations
          const pageDoc = await admin.firestore().collection(getCollectionName('pages')).doc(allocation.resourceId).get();
          const pageData = pageDoc.exists ? pageDoc.data() : null;

          if (!pageData) {
            // Page might be deleted - use stored page title and author username from allocation if available
            // This prevents "Page not found" for deleted pages
            let storedPageTitle = (allocation as any).pageTitle || '';
            let storedAuthorUsername = (allocation as any).authorUsername || '';

            // If we don't have stored values, try to get username from recipient user ID as fallback
            let authorUsername = storedAuthorUsername || 'Unknown';
            if (!storedAuthorUsername && allocation.recipientUserId) {
              try {
                authorUsername = await getUsernameByIdServer(allocation.recipientUserId);
              } catch (usernameError) {
                console.error(`Error fetching username for deleted page ${allocation.resourceId}:`, usernameError);
              }
            }

            // Use stored page title if available, otherwise show helpful message with author info
            // The page was deleted but we may still have context about it
            let pageTitle: string;
            if (storedPageTitle) {
              pageTitle = `${storedPageTitle} (deleted)`;
            } else if (authorUsername && authorUsername !== 'Unknown') {
              pageTitle = `Deleted page by ${authorUsername}`;
            } else {
              pageTitle = 'Page not found';
            }

            // Mark this allocation as needing cleanup - it's for a deleted page
            // The user should remove this allocation from their breakdown

            return {
              id: allocation.id,
              pageId: allocation.resourceId,
              pageTitle,
              authorId: allocation.recipientUserId,
              authorUsername,
              usdCents: allocation.usdCents,
              month: allocation.month,
              resourceType: allocation.resourceType,
              resourceId: allocation.resourceId,
              isDeleted: true // Flag for UI to show this allocation needs cleanup
            };
          }

          // Determine the author username with fallback logic
          let authorUsername = pageData.username;
          const authorId = pageData.userId || allocation.recipientUserId;

          // If username is missing, invalid, or generic, fetch it from user profile
          if (!authorUsername ||
              authorUsername === 'Unknown' ||
              authorUsername === 'Anonymous' ||
              authorUsername === 'Missing username' ||
              authorUsername.trim() === '') {
            try {
              authorUsername = await getUsernameByIdServer(authorId);
            } catch (usernameError) {
              console.error(`Error fetching username for user ${authorId}:`, usernameError);
              authorUsername = 'Unknown';
            }
          }

          return {
            id: allocation.id,
            pageId: allocation.resourceId,
            pageTitle: pageData.title || 'Untitled',
            authorId,
            authorUsername,
            usdCents: allocation.usdCents,
            month: allocation.month,
            resourceType: allocation.resourceType,
            resourceId: allocation.resourceId
          };
        } catch (error) {
          console.error(`Error fetching page details for ${allocation.resourceId}:`, error);

          // Try to get username from recipient user ID as fallback
          let authorUsername = 'Unknown';
          try {
            authorUsername = await getUsernameByIdServer(allocation.recipientUserId);
          } catch (usernameError) {
            console.error(`Error fetching username for error case ${allocation.resourceId}:`, usernameError);
          }

          return {
            id: allocation.id,
            pageId: allocation.resourceId,
            pageTitle: 'Error loading page',
            authorId: allocation.recipientUserId,
            authorUsername,
            usdCents: allocation.usdCents,
            month: allocation.month,
            resourceType: allocation.resourceType,
            resourceId: allocation.resourceId
          };
        }
      })
    );

    // Calculate summary
    const totalAllocatedCents = enhancedAllocations.reduce((sum, allocation) => sum + allocation.usdCents, 0);

    const response = {
      balance,
      allocations: enhancedAllocations,
      summary: {
        totalUsdCents: balance.totalUsdCents,
        allocatedUsdCents: totalAllocatedCents,
        availableUsdCents: balance.availableUsdCents,
        allocationCount: enhancedAllocations.length
      }
    };


    return NextResponse.json(response);
  } catch (error) {
    console.error('USD Allocations API: Error getting enhanced allocations:', error);
    return NextResponse.json({
      error: 'Failed to get USD allocations'
    }, { status: 500 });
  }
}
