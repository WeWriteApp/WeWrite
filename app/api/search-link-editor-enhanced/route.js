import { NextResponse } from "next/server";
import { searchUsers } from "../../firebase/database";
import { rtdb } from "../../firebase/rtdb";
import { ref, get, query, orderByChild, limitToFirst } from "firebase/database";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

/**
 * Enhanced search function for link editor that includes pages, users, and groups
 * 
 * This API provides comprehensive search results for the link editor including:
 * - Regular pages (existing functionality)
 * - User profile pages (searchable by username/display name)
 * - Group pages (searchable by group name)
 * 
 * Results are clearly categorized and formatted for easy identification
 */
async function searchForLinkEditor(userId, searchTerm, currentPageId = null, maxResults = 25) {
  try {
    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    const searchTermLower = searchTerm.toLowerCase().trim();
    const allResults = [];

    console.log(`🔗 Enhanced link editor search for: "${searchTermLower}" (maxResults: ${maxResults})`);

    // STEP 1: Search regular pages (existing functionality)
    if (allResults.length < maxResults) {
      try {
        // Import Firestore modules
        const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase/database');

        // Search user's own pages first
        if (userId) {
          const userQuery = query(
            collection(db, 'pages'),
            where('userId', '==', userId),
            where('deleted', '!=', true),
            orderBy('deleted'),
            orderBy('lastModified', 'desc'),
            limit(Math.min(maxResults, 20))
          );

          const userPagesSnapshot = await getDocs(userQuery);
          console.log(`📄 Found ${userPagesSnapshot.size} user pages`);

          userPagesSnapshot.forEach(doc => {
            if (currentPageId && doc.id === currentPageId) return;

            const data = doc.data();
            const pageTitle = data.title || 'Untitled';
            const normalizedTitle = pageTitle.toLowerCase();
            const pageContent = data.content || '';
            const normalizedContent = pageContent.toLowerCase();

            let isMatch = false;
            if (isEmptySearch) {
              isMatch = true;
            } else {
              const titleMatch = normalizedTitle.includes(searchTermLower) ||
                               normalizedTitle.startsWith(searchTermLower);
              const contentMatch = pageContent && normalizedContent.includes(searchTermLower);
              isMatch = titleMatch || contentMatch;
            }

            if (isMatch && allResults.length < maxResults) {
              allResults.push({
                id: doc.id,
                title: pageTitle,
                type: 'page',
                category: 'My Pages',
                isOwned: true,
                isEditable: true,
                userId: data.userId,
                username: data.username || null,
                isPublic: data.isPublic,
                lastModified: data.lastModified
              });
            }
          });
        }

        // Search public pages if we haven't reached the limit
        if (allResults.length < maxResults) {
          const remainingSlots = maxResults - allResults.length;
          const publicQuery = query(
            collection(db, 'pages'),
            where('isPublic', '==', true),
            where('deleted', '!=', true),
            orderBy('deleted'),
            orderBy('lastModified', 'desc'),
            limit(Math.min(remainingSlots, 15))
          );

          const publicPagesSnapshot = await getDocs(publicQuery);
          console.log(`🌐 Found ${publicPagesSnapshot.size} public pages`);

          publicPagesSnapshot.forEach(doc => {
            if ((currentPageId && doc.id === currentPageId) || 
                (userId && doc.data().userId === userId)) {
              return;
            }

            const data = doc.data();
            const pageTitle = data.title || 'Untitled';
            const normalizedTitle = pageTitle.toLowerCase();
            const pageContent = data.content || '';
            const normalizedContent = pageContent.toLowerCase();

            let isMatch = false;
            if (isEmptySearch) {
              isMatch = true;
            } else {
              const titleMatch = normalizedTitle.includes(searchTermLower) ||
                               normalizedTitle.startsWith(searchTermLower);
              const contentMatch = pageContent && normalizedContent.includes(searchTermLower);
              isMatch = titleMatch || contentMatch;
            }

            if (isMatch && allResults.length < maxResults) {
              allResults.push({
                id: doc.id,
                title: pageTitle,
                type: 'page',
                category: 'Public Pages',
                isOwned: false,
                isEditable: false,
                userId: data.userId,
                username: data.username || null,
                isPublic: data.isPublic,
                lastModified: data.lastModified
              });
            }
          });
        }
      } catch (error) {
        console.warn('Error searching pages:', error);
      }
    }

    // STEP 2: Search users (for user profile pages)
    if (!isEmptySearch && allResults.length < maxResults) {
      try {
        const users = await searchUsers(searchTermLower, Math.min(maxResults - allResults.length, 10));
        console.log(`👤 Found ${users.length} users`);

        users.forEach(user => {
          if (allResults.length < maxResults) {
            allResults.push({
              id: user.id,
              title: user.username || user.email || 'Anonymous User',
              type: 'user',
              category: 'User Profiles',
              isOwned: user.id === userId,
              isEditable: false,
              userId: user.id,
              username: user.username,
              photoURL: user.photoURL || null
            });
          }
        });
      } catch (error) {
        console.warn('Error searching users:', error);
      }
    }

    // STEP 3: Search groups (for group pages)
    if (!isEmptySearch && allResults.length < maxResults) {
      try {
        const groupsRef = ref(rtdb, 'groups');
        const groupsSnapshot = await get(groupsRef);
        
        if (groupsSnapshot.exists()) {
          const groups = groupsSnapshot.val();
          const matchingGroups = [];

          Object.entries(groups).forEach(([groupId, groupData]) => {
            const groupName = groupData.name || '';
            const groupDescription = groupData.description || '';
            const normalizedName = groupName.toLowerCase();
            const normalizedDescription = groupDescription.toLowerCase();

            // Check if group matches search term
            const nameMatch = normalizedName.includes(searchTermLower) ||
                             normalizedName.startsWith(searchTermLower);
            const descriptionMatch = normalizedDescription.includes(searchTermLower);

            // Check if user has access to this group (public or member)
            const isPublic = groupData.isPublic === true;
            const isMember = userId && groupData.members && groupData.members[userId];
            const hasAccess = isPublic || isMember;

            if ((nameMatch || descriptionMatch) && hasAccess && allResults.length < maxResults) {
              allResults.push({
                id: groupId,
                title: groupName,
                type: 'group',
                category: 'Groups',
                isOwned: groupData.owner === userId,
                isEditable: false,
                description: groupDescription,
                isPublic: isPublic,
                memberCount: groupData.members ? Object.keys(groupData.members).length : 0
              });
            }
          });

          console.log(`🏢 Found ${matchingGroups.length} accessible groups`);
        }
      } catch (error) {
        console.warn('Error searching groups:', error);
      }
    }

    // Sort results by relevance and category
    allResults.sort((a, b) => {
      // Prioritize owned content
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;

      // Then by category: pages > users > groups
      const categoryOrder = { 'page': 0, 'user': 1, 'group': 2 };
      const aOrder = categoryOrder[a.type] || 3;
      const bOrder = categoryOrder[b.type] || 3;
      if (aOrder !== bOrder) return aOrder - bOrder;

      // Finally by last modified (if available)
      if (a.lastModified && b.lastModified) {
        return new Date(b.lastModified) - new Date(a.lastModified);
      }

      return 0;
    });

    console.log(`🔗 Enhanced search completed. Found ${allResults.length} total results`);
    return allResults.slice(0, maxResults);

  } catch (error) {
    console.error('Error in enhanced link editor search:', error);
    return [];
  }
}

export async function GET(request) {
  try {
    // Extract query parameters from the URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const searchTerm = searchParams.get("searchTerm") || "";
    const currentPageId = searchParams.get("currentPageId");
    const maxResults = parseInt(searchParams.get("maxResults") || "25");

    console.log(`🔗 Enhanced Link Editor Search API called:`, {
      searchTerm,
      userId,
      currentPageId,
      maxResults,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();

    // Use enhanced search function
    const results = await searchForLinkEditor(userId, searchTerm, currentPageId, maxResults);
    
    const searchTime = Date.now() - startTime;
    console.log(`🔗 Enhanced search completed in ${searchTime}ms. Found ${results?.length || 0} results`);

    // Group results by category for better organization
    const groupedResults = {
      pages: results.filter(r => r.type === 'page'),
      users: results.filter(r => r.type === 'user'),
      groups: results.filter(r => r.type === 'group')
    };

    const response = {
      results: results || [],
      grouped: groupedResults,
      source: "enhanced_link_editor",
      searchTerm: searchTerm,
      userId: userId,
      performance: {
        searchTimeMs: searchTime,
        totalResults: results?.length || 0,
        pageResults: groupedResults.pages.length,
        userResults: groupedResults.users.length,
        groupResults: groupedResults.groups.length,
        maxResults,
        currentPageExcluded: !!currentPageId
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in enhanced link editor search API:', error);
    return NextResponse.json({
      results: [],
      grouped: { pages: [], users: [], groups: [] },
      error: 'Search temporarily unavailable',
      source: "enhanced_link_editor_error"
    }, { status: 200 });
  }
}
