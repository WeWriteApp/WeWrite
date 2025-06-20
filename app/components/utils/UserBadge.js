"use client";
import React, { useState, useEffect} from "react";
import { getSingleUserData } from "../../firebase/batchUserData";
import { UsernameSkeleton } from "../ui/skeleton";
import Link from "next/link";

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
        const userData = await getSingleUserData(uid);

        if (userData && userData.username) {
          setUsername(userData.username);
        } else {
          setUsername("Missing username");
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
        username
      )}
    </Link>
  );
}

export default User;