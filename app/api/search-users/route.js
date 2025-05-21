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

    // IMPORTANT FIX: Log more details about the search request
    console.log('Search Users API request details:', {
      searchTerm,
      searchTermLength: searchTerm ? searchTerm.length : 0,
      searchTermTrimmed: searchTerm ? searchTerm.trim() : '',
      searchTermTrimmedLength: searchTerm ? searchTerm.trim().length : 0,
      limit,
      url: request.url
    });

    if (!searchTerm || searchTerm.trim().length < 1) {
      console.log('Empty or too short search term provided to search-users API, returning empty results');
      return NextResponse.json(
        {
          users: [],
          message: "searchTerm must be at least 1 character"
        },
        { status: 400 }
      );
    }

    // Search for users
    console.log(`API: Searching for users with query "${searchTerm}"`);
    const users = await searchUsers(searchTerm, limit);
    console.log('API: Raw user search results:', users);

    // Format the users for the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username || "Anonymous",
      photoURL: user.photoURL || null,
      type: 'user' // Add a type field to distinguish from pages
    }));

    console.log(`API: Found ${formattedUsers.length} users matching query "${searchTerm}"`);

    // Apply scoring to sort results
    const sortedUsers = sortSearchResultsByScore(formattedUsers, searchTerm);
    console.log('API: Sorted user results:', sortedUsers);

    // Return formatted results
    return NextResponse.json({ users: sortedUsers }, { status: 200 });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({
      users: [],
      error: {
        message: error.message,
        details: error.stack
      }
    }, { status: 500 });
  }
}
