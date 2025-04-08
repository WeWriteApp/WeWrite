"use client";

/**
 * API Utilities
 * 
 * Functions for interacting with the application's API endpoints
 */

/**
 * Fetches a username from the server API
 * This is more reliable than client-side fetching as it has access to admin SDK
 * 
 * @param {string} userId - The user ID to fetch the username for
 * @returns {Promise<string>} - The username or "Anonymous" if not found
 */
export const fetchUsernameFromApi = async (userId) => {
  if (!userId) return "Anonymous";
  
  try {
    console.log(`Fetching username from API for user ID: ${userId}`);
    const response = await fetch(`/api/username?userId=${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return "Anonymous";
    }
    
    const data = await response.json();
    
    if (data.username && data.username !== "Unknown" && !data.username.startsWith("user_")) {
      console.log(`API returned username: ${data.username}`);
      return data.username;
    }
    
    console.log(`API returned invalid username: ${data.username}, using Anonymous`);
    return "Anonymous";
  } catch (error) {
    console.error("Error fetching username from API:", error);
    return "Anonymous";
  }
};
