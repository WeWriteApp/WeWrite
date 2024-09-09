"use client";
import React, { useState, useEffect} from "react";
import { rtdb } from "../firebase/rtdb";
import { ref, get } from "firebase/database";
import Link from "next/link";

const Profile = ({ uid }) => {
  const [profile, setProfile] = useState({});
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const profileRef = ref(rtdb, `users/${uid}`);
    get(profileRef).then((snapshot) => {
      let user = snapshot.val();

      if (user.pages) {
        // count isPublic pages
        let count = 0;
        for (let page in user.pages) {
          if (user.pages[page].isPublic && !user.pages[page].groupId) {
            count++;
          }
        }
        setPageCount(count);
      }

      setProfile(user);
    });
  }, [uid]);
  return (
    <Link href={`/profile/${uid}`} className="text-text underline">
      {profile.username} - ({pageCount})
    </Link>
  );
}

export default Profile;