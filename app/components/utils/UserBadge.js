"use client";
import React, { useState, useEffect} from "react";
import { getSingleUserData } from "../../firebase/batchUserData";
import { UsernameSkeleton } from "../ui/skeleton";
import Link from "next/link";
import { sanitizeUsername } from "../../utils/usernameSecurity";

// Simple in-memory cache to prevent duplicate API calls
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const User = ({ uid, showUsername = true, className = "" }) => {
  const [username, setUsername] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUsername("Missing username");
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        // Check cache first
        const cached = userCache.get(uid);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setUsername(cached.username);
          setIsLoading(false);
          return;
        }

        // Use the same API endpoint as UsernameBadge for consistency
        const response = await fetch(`/api/users/profile?id=${encodeURIComponent(uid)}`);

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.username) {
            const username = result.data.username;
            setUsername(username);
            // Cache the result
            userCache.set(uid, { username, timestamp: Date.now() });
          } else {
            setUsername("Missing username");
          }
        } else {
          // Fallback to old method if API fails
          const userData = await getSingleUserData(uid);
          if (userData && userData.username) {
            const username = userData.username;
            setUsername(username);
            // Cache the result
            userCache.set(uid, { username, timestamp: Date.now() });
          } else {
            setUsername("Missing username");
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUsername("Missing username");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [uid]);

  if (!showUsername) {
    return null;
  }

  return (
    <Link
      href={`/user/${uid}`}
      className={`text-primary hover:underline font-medium ${className} ${isLoading ? 'opacity-60' : ''}`}
      onClick={(e) => {
        // Prevent the event from bubbling up to parent elements
        e.stopPropagation();
        e.preventDefault();
        // Navigate programmatically to user profile
        window.location.href = `/user/${uid}`;
      }}
    >
      {isLoading ? (
        <UsernameSkeleton />
      ) : (
        sanitizeUsername(username)
      )}
    </Link>
  );
}

export default User;