import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenService } from '../../../services/tokenService';
import { ServerTokenService } from '../../../services/tokenService.server';
import { getOptimizedPageMetadata } from '../../../firebase/optimizedPages';
import { getUsernameById } from '../../../utils/userUtils';

interface PageAllocation {
  id: string;
  pageId: string;
  pageTitle: string;
  authorId: string;
  authorUsername: string;
  tokens: number;
  month: string;
}

/**
 * GET /api/tokens/allocations
 * Get user's token allocations with page details
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get token balance first to check if user has any allocations
    console.log(`Fetching token balance for user ${userId}`);

    const balance = await ServerTokenService.getUserTokenBalance(userId);
    if (!balance) {
      return NextResponse.json({
        success: true,
        allocations: [],
        summary: {
          totalAllocations: 0,
          totalTokensAllocated: 0,
          balance: null
        },
        message: 'No token balance found. Subscribe to start allocating tokens.'
      });
    }

    // If user has allocated tokens, try to get the detailed allocations
    if (balance.allocatedTokens === 0) {
      return NextResponse.json({
        success: true,
        allocations: [],
        summary: {
          totalAllocations: 0,
          totalTokensAllocated: 0,
          balance: balance
        }
      });
    }

    // Try to get detailed allocations using ServerTokenService
    console.log(`User has ${balance.allocatedTokens} allocated tokens, fetching detailed allocations`);

    let pageAllocations: any[] = [];
    try {
      const allocations = await ServerTokenService.getUserTokenAllocations(userId);
      console.log(`Found ${allocations.length} total allocations for user ${userId}`);

      // Filter for page allocations only
      pageAllocations = allocations.filter(allocation => allocation.resourceType === 'page');
      console.log(`Found ${pageAllocations.length} page allocations for user ${userId}`);
    } catch (error) {
      console.error('Error fetching detailed allocations:', error);
      // If we can't get detailed allocations, return summary only
      return NextResponse.json({
        success: true,
        allocations: [],
        summary: {
          totalAllocations: 0,
          totalTokensAllocated: balance.allocatedTokens,
          balance: balance
        },
        message: 'Token allocations exist but details could not be loaded.'
      });
    }

    // Enhance allocations with page details
    const enhancedAllocations: PageAllocation[] = await Promise.all(
      pageAllocations.map(async (allocation) => {
        try {
          // Get page metadata (disable caching for server-side calls)
          const pageData = await getOptimizedPageMetadata(allocation.resourceId, {
            fieldsOnly: ['title', 'username', 'userId'],
            useCache: false
          });

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
              tokens: allocation.tokens,
              month: allocation.month
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
              authorUsername = await getUsernameById(authorId);
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
            tokens: allocation.tokens,
            month: allocation.month
          };
        } catch (error) {
          console.error(`Error fetching page details for ${allocation.resourceId}:`, error);

          // Try to get username from recipient user ID as fallback
          let authorUsername = 'Unknown';
          try {
            authorUsername = await getUsernameById(allocation.recipientUserId);
          } catch (usernameError) {
            console.error(`Error fetching username for error case ${allocation.resourceId}:`, usernameError);
          }

          // Return allocation with fallback data
          return {
            id: allocation.id,
            pageId: allocation.resourceId,
            pageTitle: 'Error loading page',
            authorId: allocation.recipientUserId,
            authorUsername,
            tokens: allocation.tokens,
            month: allocation.month
          };
        }
      })
    );

    // Sort by tokens (highest first)
    enhancedAllocations.sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({
      success: true,
      allocations: enhancedAllocations,
      summary: {
        totalAllocations: enhancedAllocations.length,
        totalTokensAllocated: enhancedAllocations.reduce((sum, allocation) => sum + allocation.tokens, 0),
        balance: balance
      }
    });

  } catch (error) {
    console.error('Error getting token allocations:', error);
    return NextResponse.json(
      { error: 'Failed to get token allocations' },
      { status: 500 }
    );
  }
}
