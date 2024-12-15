"use client";
import React, { useState, useEffect } from "react";
import { rtdb } from "../firebase/rtdb";
import { ref, get } from "firebase/database";
import Link from "next/link";

const User = ({ uid }) => {
  const [profile, setProfile] = useState({ username: 'Loading...' });

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      try {
        const profileRef = ref(rtdb, `users/${uid}`);
        const snapshot = await get(profileRef);
        const user = snapshot.val();
        setProfile(user || { username: 'Unknown User' });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setProfile({ username: 'Unknown User' });
      }
    };

    fetchProfile();
  }, [uid]);

  return (
    <Link href={`/user/${uid}`} className="text-text underline">
      {profile.username}
    </Link>
  );
};

export default User;
