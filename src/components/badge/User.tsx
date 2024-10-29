"use client";
import React, { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import Link from "next/link";
import { rtdb } from "@/firebase/rtdb";

const User = ({ uid }: any) => {
  const [profile, setProfile] = useState<any>({});

  useEffect(() => {
    if (!uid) return;
    const profileRef = ref(rtdb, `users/${uid}`);
    get(profileRef).then((snapshot) => {
      let user = snapshot.val();
      setProfile(user);
    });
  }, [uid]);
  return (
    <Link href={`/user/${uid}`} className="text-text underline">
      {profile.username}
    </Link>
  );
}

export default User;