"use client";
import React, { useState, useEffect} from "react";
import { rtdb } from "../../firebase/rtdb";
import { ref, get } from "firebase/database";
import Link from "next/link";

const User = ({ uid }) => {
  const [profile, setProfile] = useState({});

  useEffect(() => {
    if (!uid) return;
    const profileRef = ref(rtdb, `users/${uid}`);
    get(profileRef).then((snapshot) => {
      let user = snapshot.val();
      setProfile(user);
    });
  }, [uid]);
  return (
    <Link
      href={`/user/${uid}`}
      className="text-primary hover:underline font-medium"
      onClick={(e) => {
        // Prevent the event from bubbling up to parent elements
        e.stopPropagation();
        e.preventDefault();
        // Navigate programmatically to user profile
        window.location.href = `/user/${uid}`;
      }}
    >
      {profile.username || "Missing username"}
    </Link>
  );
}

export default User;