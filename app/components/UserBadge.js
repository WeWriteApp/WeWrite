"use client";
import React, { useState, useEffect } from "react";
import { getFirebase } from "../firebase/rtdb";
import { ref, get } from "../firebase/rtdb";
import Link from "next/link";

const User = ({ uid }) => {
  const [profile, setProfile] = useState({ username: 'Loading...' });

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      try {
        const { rtdb } = await getFirebase();
        const userRef = ref(rtdb, `users/${uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();

        if (userData) {
          setProfile(userData);
        } else {
          setProfile({ username: 'Unknown User' });
        }
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
