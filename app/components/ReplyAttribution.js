"use client";

import React, { useState, useEffect } from 'react';
import { fetchUsernameFromApi } from '../utils/apiUtils';

/**
 * ReplyAttribution Component
 *
 * A specialized component for displaying the attribution line in replies.
 * This component directly fetches the username from the API and renders it.
 *
 * @param {Object} props
 * @param {string} props.pageId - ID of the page being replied to
 * @param {string} props.pageTitle - Title of the page being replied to
 * @param {string} props.userId - ID of the original page author
 */
export default function ReplyAttribution({ pageId, pageTitle, userId }) {
  const [username, setUsername] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch the username directly from the API
    const getUsername = async () => {
      if (!userId) {
        setUsername("Anonymous");
        setIsLoading(false);
        return;
      }

      try {
        console.log(`ReplyAttribution: Fetching username for user ID: ${userId}`);
        const apiUsername = await fetchUsernameFromApi(userId);
        
        if (apiUsername && apiUsername !== "Anonymous") {
          console.log(`ReplyAttribution: API returned username: ${apiUsername}`);
          setUsername(apiUsername);
        } else {
          console.log(`ReplyAttribution: API returned invalid username, using Anonymous`);
          setUsername("Anonymous");
        }
      } catch (error) {
        console.error("ReplyAttribution: Error fetching username:", error);
        setUsername("Anonymous");
      } finally {
        setIsLoading(false);
      }
    };

    getUsername();
  }, [userId]);

  return (
    <div className="reply-attribution py-2 text-muted-foreground">
      <span>Replying to </span>
      <a 
        href={`/${pageId}`} 
        className="page-link bg-primary text-primary-foreground px-2 py-0.5 rounded-md mx-1"
      >
        {pageTitle || "Untitled"}
      </a>
      <span> by </span>
      <a 
        href={`/u/${userId || "anonymous"}`} 
        className="user-link bg-primary text-primary-foreground px-2 py-0.5 rounded-md mx-1"
      >
        {isLoading ? "Loading..." : username}
      </a>
    </div>
  );
}
