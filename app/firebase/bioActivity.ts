"use client";

import { db } from "./config";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type DocumentData,
  type QuerySnapshot
} from "firebase/firestore";
import { rtdb } from "./rtdb";
import { ref, get, push, set } from "firebase/database";
import { hasContentChanged } from "../utils/diffService";
import { getCollectionName } from "../utils/environmentConfig";

// Type definitions for bio activity operations
interface BioActivityData {
  type: string;
  userId: string;
  username: string;
  editorId: string;
  editorUsername: string;
  timestamp: any;
  content: string;
  previousContent: string;
}

/**
 * Records a bio edit activity in Firestore
 *
 * @param userId - The ID of the user whose bio was edited
 * @param editorId - The ID of the user who made the edit
 * @param editorUsername - The username of the user who made the edit
 * @param content - The new content of the bio
 * @param previousContent - The previous content of the bio
 * @returns The ID of the created activity document
 */
export const recordBioEditActivity = async (
  userId: string,
  editorId: string,
  editorUsername: string,
  content: any,
  previousContent: any
): Promise<string | null> => {
  try {
    // Skip activity recording if content hasn't actually changed
    if (!hasContentChanged(content, previousContent)) {
      console.log('Bio content unchanged after normalization, skipping activity recording');
      return null;
    }

    // Get user data to include username
    const userRef = ref(rtdb, `users/${userId}`);
    const userSnapshot = await get(userRef);

    if (!userSnapshot.exists()) {
      console.error(`User ${userId} not found`);
      return null;
    }

    const userData = userSnapshot.val();
    const username = userData.username || "Unknown";

    // Create activity document
    const activityData: BioActivityData = {
      type: "bio_edit",
      userId: userId,
      username: username,
      editorId: editorId,
      editorUsername: editorUsername,
      timestamp: serverTimestamp(),
      content: JSON.stringify(content),
      previousContent: JSON.stringify(previousContent || ""),
      isPublic: true // Bio edits are always public
    };

    const activityRef = await addDoc(collection(db, getCollectionName("activities")), activityData);
    console.log(`Bio edit activity recorded with ID: ${activityRef.id}`);
    return activityRef.id;
  } catch (error) {
    console.error("Error recording bio edit activity:", error);
    return null;
  }
};

/**
 * Records a group about page edit activity in Firestore
 *
 * @param groupId - The ID of the group whose about page was edited
 * @param editorId - The ID of the user who made the edit
 * @param editorUsername - The username of the user who made the edit
 * @param content - The new content of the about page
 * @param previousContent - The previous content of the about page
 * @param isPublic - Whether the group is public
 * @returns The ID of the created activity document
 */
export const recordGroupAboutEditActivity = async (
  groupId: string,
  editorId: string,
  editorUsername: string,
  content: any,
  previousContent: any,
  isPublic: boolean
): Promise<string | null> => {
  try {
    // Skip activity recording if content hasn't actually changed
    if (!hasContentChanged(content, previousContent)) {
      console.log('Group about content unchanged after normalization, skipping activity recording');
      return null;
    }

    // Get group data to include name
    const groupRef = ref(rtdb, `groups/${groupId}`);
    const groupSnapshot = await get(groupRef);

    if (!groupSnapshot.exists()) {
      console.error(`Group ${groupId} not found`);
      return null;
    }

    const groupData = groupSnapshot.val();
    const groupName = groupData?.name || 'Unknown Group';

    // Record the activity
    const activityRef = ref(rtdb, 'activities');
    const newActivityRef = push(activityRef);
    await set(newActivityRef, {
      type: 'group_about_edit',
      groupId,
      groupName,
      editorId,
      editorUsername,
      isPublic,
      timestamp: Date.now(),
    });

    return newActivityRef.key;
  } catch (error) {
    console.error("Error recording group about edit activity:", error);
    return null;
  }
};

// Return type for getBioAndAboutActivities
interface ProcessedActivityData {
  id: string;
  type: string;
  userId?: string;
  username?: string;
  groupId?: string;
  groupName?: string;
  editorId: string;
  editorUsername: string;
  timestamp: Date;
  content: any;
  previousContent: any;
  isPublic: boolean;
}

/**
 * Gets recent bio and about page edit activities
 *
 * @param limitCount - Maximum number of activities to return
 * @param currentUserId - The ID of the current user (for privacy filtering)
 * @returns Array of activity objects
 */
export const getBioAndAboutActivities = async (
  limitCount: number = 10,
  currentUserId: string | null = null
): Promise<ProcessedActivityData[]> => {
  try {
    // Query for public bio and about page edits
    const activitiesQuery = query(
      collection(db, getCollectionName("activities")),
      where("type", "in", ["bio_edit", "group_about_edit"]),
      where("isPublic", "==", true),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    
    const activitiesSnapshot: QuerySnapshot<DocumentData> = await getDocs(activitiesQuery);

    if (activitiesSnapshot.empty) {
      return [];
    }

    // Process activities
    const activities: ProcessedActivityData[] = activitiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        userId: data.userId,
        username: data.username,
        groupId: data.groupId,
        groupName: data.groupName,
        editorId: data.editorId,
        editorUsername: data.editorUsername,
        timestamp: data.timestamp?.toDate() || new Date(),
        content: data.content ? JSON.parse(data.content) : "",
        previousContent: data.previousContent ? JSON.parse(data.previousContent) : "",
        isPublic: data.isPublic
      };
    });
    
    return activities;
  } catch (error) {
    console.error("Error getting bio and about activities:", error);
    return [];
  }
};