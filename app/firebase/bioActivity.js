import { db } from "./config";
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { rtdb } from "./rtdb";
import { ref, get } from "firebase/database";

/**
 * Records a bio edit activity in Firestore
 * 
 * @param {string} userId - The ID of the user whose bio was edited
 * @param {string} editorId - The ID of the user who made the edit
 * @param {string} editorUsername - The username of the user who made the edit
 * @param {Object} content - The new content of the bio
 * @param {Object} previousContent - The previous content of the bio
 * @returns {Promise<string>} - The ID of the created activity document
 */
export const recordBioEditActivity = async (userId, editorId, editorUsername, content, previousContent) => {
  try {
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
    const activityData = {
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
    
    const activityRef = await addDoc(collection(db, "activities"), activityData);
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
 * @param {string} groupId - The ID of the group whose about page was edited
 * @param {string} editorId - The ID of the user who made the edit
 * @param {string} editorUsername - The username of the user who made the edit
 * @param {Object} content - The new content of the about page
 * @param {Object} previousContent - The previous content of the about page
 * @param {boolean} isPublic - Whether the group is public
 * @returns {Promise<string>} - The ID of the created activity document
 */
export const recordGroupAboutEditActivity = async (groupId, editorId, editorUsername, content, previousContent, isPublic) => {
  try {
    // Get group data to include name
    const groupRef = ref(rtdb, `groups/${groupId}`);
    const groupSnapshot = await get(groupRef);
    
    if (!groupSnapshot.exists()) {
      console.error(`Group ${groupId} not found`);
      return null;
    }
    
    const groupData = groupSnapshot.val();
    const groupName = groupData.name || "Unknown Group";
    
    // Create activity document
    const activityData = {
      type: "group_about_edit",
      groupId: groupId,
      groupName: groupName,
      editorId: editorId,
      editorUsername: editorUsername,
      timestamp: serverTimestamp(),
      content: JSON.stringify(content),
      previousContent: JSON.stringify(previousContent || ""),
      isPublic: isPublic // Respect group privacy setting
    };
    
    const activityRef = await addDoc(collection(db, "activities"), activityData);
    console.log(`Group about edit activity recorded with ID: ${activityRef.id}`);
    return activityRef.id;
  } catch (error) {
    console.error("Error recording group about edit activity:", error);
    return null;
  }
};

/**
 * Gets recent bio and about page edit activities
 * 
 * @param {number} limitCount - Maximum number of activities to return
 * @param {string} currentUserId - The ID of the current user (for privacy filtering)
 * @returns {Promise<Array>} - Array of activity objects
 */
export const getBioAndAboutActivities = async (limitCount = 10, currentUserId = null) => {
  try {
    // Query for public bio and about page edits
    const activitiesQuery = query(
      collection(db, "activities"),
      where("type", "in", ["bio_edit", "group_about_edit"]),
      where("isPublic", "==", true),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    
    const activitiesSnapshot = await getDocs(activitiesQuery);
    
    if (activitiesSnapshot.empty) {
      return [];
    }
    
    // Process activities
    const activities = activitiesSnapshot.docs.map(doc => {
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
