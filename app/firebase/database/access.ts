import { get, ref } from "firebase/database";
import { rtdb } from "../rtdb";
import type { PageAccessResult, PageData } from "./core";
import type { Group } from "../../types/database";

/**
 * Utility function to check if a user has access to a page
 */
export const checkPageAccess = async (pageData: PageData | null, userId: string | null): Promise<PageAccessResult> => {
  // If page doesn't exist, no one has access
  if (!pageData) {
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // CRITICAL: Check if page is soft-deleted
  // Only page owners can access their own deleted pages through the "Recently Deleted Pages" section
  if (pageData.deleted === true) {
    // Allow page owners to access their deleted pages only in specific contexts
    if (userId && pageData.userId === userId) {
      // This will be handled by the calling code to determine if it's in the right context
      // For now, we'll allow access but the calling code should check the context
      return {
        hasAccess: true,
        reason: "owner accessing deleted page",
        isDeleted: true
      };
    }

    // For all other users, deleted pages are not accessible
    return {
      hasAccess: false,
      error: "Page not found"
    };
  }

  // Private pages are accessible to their owners regardless of other settings
  if (userId && pageData.userId === userId) {
    return {
      hasAccess: true,
      reason: "owner"
    };
  }

  // Check if the page belongs to a group
  if (pageData.groupId) {
    try {
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        const groupData = groupSnapshot.val() as Group;

        // If the group is public, public pages are accessible to everyone
        if (groupData.isPublic && pageData.isPublic) {
          return {
            hasAccess: true,
            reason: "public page in public group"
          };
        }

        // If the group is public, private pages are also accessible to everyone
        // This is because adding a page to a public group makes it visible to everyone
        if (groupData.isPublic && !pageData.isPublic) {
          return {
            hasAccess: true,
            reason: "private page in public group"
          };
        }

        // For private groups, check if the user is a member
        if (!groupData.isPublic) {
          // If user is not logged in, deny access to private group content
          if (!userId) {
            return {
              hasAccess: false,
              error: "Access denied: This page belongs to a private group"
            };
          }

          // Check if the user is a member of the group
          if (groupData.members && groupData.members[userId]) {
            return {
              hasAccess: true,
              reason: "group member"
            };
          }

          // If not a member, deny access
          return {
            hasAccess: false,
            error: "Access denied: This page belongs to a private group and is only accessible to group members"
          };
        }
      }
    } catch (error) {
      console.error("Error checking group membership:", error);
      return {
        hasAccess: false,
        error: "Error checking group access"
      };
    }
  }

  // For pages not in groups, public pages are accessible to everyone
  if (pageData.isPublic) {
    return {
      hasAccess: true,
      reason: "public page"
    };
  }

  // Otherwise, access is denied (private page not in a group and user is not the owner)
  return {
    hasAccess: false,
    error: "Access denied: This page is private and can only be viewed by its owner"
  };
};

/**
 * Utility function to get user's group memberships efficiently
 */
export const getUserGroupMemberships = async (userId: string | null): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const userGroupsRef = ref(rtdb, `users/${userId}/groups`);
    const userGroupsSnapshot = await get(userGroupsRef);

    if (!userGroupsSnapshot.exists()) {
      return [];
    }

    const userGroups = userGroupsSnapshot.val();
    return Object.keys(userGroups);
  } catch (error) {
    console.error("Error getting user group memberships:", error);
    return [];
  }
};

/**
 * Utility function to get group data for multiple groups efficiently
 */
export const getGroupsData = async (groupIds: string[]): Promise<Record<string, Group>> => {
  if (!groupIds || groupIds.length === 0) {
    return {};
  }

  try {
    const groupsData: Record<string, Group> = {};

    // Fetch all groups in parallel
    const groupPromises = groupIds.map(async (groupId) => {
      const groupRef = ref(rtdb, `groups/${groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        groupsData[groupId] = groupSnapshot.val() as Group;
      }
    });

    await Promise.all(groupPromises);
    return groupsData;
  } catch (error) {
    console.error("Error getting groups data:", error);
    return {};
  }
};

/**
 * Check if a user can edit a specific page
 */
export const canUserEditPage = async (pageData: PageData | null, userId: string | null): Promise<boolean> => {
  if (!pageData || !userId) {
    return false;
  }

  // Page owner can always edit
  if (pageData.userId === userId) {
    return true;
  }

  // Check group permissions if page belongs to a group
  if (pageData.groupId) {
    try {
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        const groupData = groupSnapshot.val() as Group;

        // Group owner can edit all pages in the group
        if (groupData.owner === userId) {
          return true;
        }

        // Check if user is a member with edit permissions
        if (groupData.members && groupData.members[userId]) {
          const memberData = groupData.members[userId];
          return memberData.role === 'admin' || memberData.canEdit === true;
        }
      }
    } catch (error) {
      console.error("Error checking group edit permissions:", error);
      return false;
    }
  }

  return false;
};

/**
 * Check if a user can delete a specific page
 */
export const canUserDeletePage = async (pageData: PageData | null, userId: string | null): Promise<boolean> => {
  if (!pageData || !userId) {
    return false;
  }

  // Page owner can always delete
  if (pageData.userId === userId) {
    return true;
  }

  // Check group permissions if page belongs to a group
  if (pageData.groupId) {
    try {
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const groupSnapshot = await get(groupRef);

      if (groupSnapshot.exists()) {
        const groupData = groupSnapshot.val() as Group;

        // Group owner can delete all pages in the group
        if (groupData.owner === userId) {
          return true;
        }

        // Check if user is an admin member
        if (groupData.members && groupData.members[userId]) {
          const memberData = groupData.members[userId];
          return memberData.role === 'admin';
        }
      }
    } catch (error) {
      console.error("Error checking group delete permissions:", error);
      return false;
    }
  }

  return false;
};
