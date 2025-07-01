import { NextResponse } from "next/server";
import { searchUsers } from "../../firebase/database";
import { sortSearchResultsByScore } from "../../utils/searchUtils";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters from the URL
    const searchTerm = searchParams.get("searchTerm");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")) : 10;

    // Reduce logging to essential information only
    console.log('Search Users API request:', {
      searchTerm: searchTerm || '',
      limit
    });

    // CRITICAL FIX: Return empty results with 200 status instead of 400 error
    // This prevents the API error from breaking the link insertion flow
    if (!searchTerm || searchTerm.trim().length < 1) {
      console.log('Empty search term, returning empty results with 200 status');
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    // Search for users
    const users = await searchUsers(searchTerm, limit);

    // Format the users for the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username || "Anonymous",
      photoURL: user.photoURL || null,
      type: 'user' // Add a type field to distinguish from pages
    }));

    console.log(`Found ${formattedUsers.length} users matching "${searchTerm}"`);

    // Apply scoring to sort results
    const sortedUsers = sortSearchResultsByScore(formattedUsers, searchTerm);

    // Return formatted results
    return NextResponse.json({ users: sortedUsers }, { status: 200 });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({
      users: [],
      error: {
        message: error.message
      }
    }, { status: 500 });
  }
}