import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';
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
      console.log(`👤 [ALLOCATIONS API] User document not found for: ${userId}`);
      return "Missing username";
    }

    const userData = userDoc.data();
    const username = userData?.username;

    // Check for valid username
    if (username &&
        username !== "Anonymous" &&
        username !== "Missing username" &&
        username.trim() !== "") {
      console.log(`👤 [ALLOCATIONS API] Found valid username: ${username} for user: ${userId}`);
      return username.trim();
    }

    console.log(`👤 [ALLOCATIONS API] User found but no valid username for: ${userId}`, {
      hasUsername: !!username,
      username
    });
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

    console.log(`🎯 USD Allocations API: Getting enhanced allocations for user ${userId} (with user allocation fix v3)`);

    // Get USD balance and allocations
    const balance = await ServerUsdService.getUserUsdBalance(userId);
    const allocations = await ServerUsdService.getUserUsdAllocations(userId);

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
          console.log(`Processing allocation: resourceType=${allocation.resourceType}, resourceId=${allocation.resourceId}`);
          const isUserAllocation = allocation.resourceType === 'user' || allocation.resourceId.startsWith('user/');
          console.log(`Is user allocation: ${isUserAllocation}, resourceType check: ${allocation.resourceType === 'user'}, resourceId check: ${allocation.resourceId.startsWith('user/')}`);

          if (isUserAllocation) {
            const userId = allocation.resourceId.replace('user/', '');

            try {
              console.log(`Fetching username for user allocation: ${userId}`);
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
            // Page might be deleted, try to get username from recipient user ID as fallback
            let authorUsername = 'Unknown';
            try {
              authorUsername = await getUsernameById(allocation.recipientUserId);
            } catch (usernameError) {
              console.error(`Error fetching username for deleted page ${allocation.resourceId}:`, usernameError);
            }

            return {
              id: allocation.id,
              pageId: allocation.resourceId,
              pageTitle: 'Page not found',
              authorId: allocation.recipientUserId,
              authorUsername,
              usdCents: allocation.usdCents,
              month: allocation.month,
              resourceType: allocation.resourceType,
              resourceId: allocation.resourceId
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
              console.log(`Fetching username for user ${authorId} (page ${allocation.resourceId})`);
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

    console.log(`🎯 USD Allocations API: Returning ${enhancedAllocations.length} enhanced allocations`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('USD Allocations API: Error getting enhanced allocations:', error);
    return NextResponse.json({
      error: 'Failed to get USD allocations'
    }, { status: 500 });
  }
}
