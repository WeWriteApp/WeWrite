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

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get token balance first to check if user has any allocations
    console.log(`Fetching token balance for user ${userId}`);

    const balance = await ServerTokenService.getUserTokenBalance(userId);
    console.log('🎯 Token Allocations API: User balance', {
      userId,
      balance,
      hasBalance: !!balance,
      allocatedTokens: balance?.allocatedTokens
    });

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

    // Always try to get detailed allocations regardless of balance.allocatedTokens
    // because the balance.allocatedTokens field might be stale
    console.log('🎯 Token Allocations API: Checking allocated tokens', {
      allocatedTokens: balance.allocatedTokens,
      note: 'Will fetch actual allocations to get real count'
    });

    // Try to get detailed allocations using ServerTokenService
    console.log(`User has ${balance.allocatedTokens} allocated tokens, fetching detailed allocations`);

    let pageAllocations: any[] = [];
    try {
      const allocations = await ServerTokenService.getUserTokenAllocations(userId);
      console.log(`Found ${allocations.length} total allocations for user ${userId}`);

      // Filter for page allocations only
      pageAllocations = allocations.filter(allocation => allocation.resourceType === 'page');
      console.log(`Found ${pageAllocations.length} page allocations for user ${userId}`);

      // If no page allocations found, return empty result
      if (pageAllocations.length === 0) {
        console.log('🎯 Token Allocations API: No page allocations found');
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

    // Apply pagination
    const totalAllocations = enhancedAllocations.length;
    const paginatedAllocations = enhancedAllocations.slice(offset, offset + limit);
    const hasMore = offset + limit < totalAllocations;

    return NextResponse.json({
      success: true,
      allocations: paginatedAllocations,
      pagination: {
        offset,
        limit,
        total: totalAllocations,
        hasMore,
        returned: paginatedAllocations.length
      },
      summary: {
        totalAllocations: totalAllocations,
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