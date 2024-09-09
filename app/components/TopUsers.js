"use client";
import React, { useState, useEffect} from "react";
import { rtdb } from "../firebase/rtdb";
import { ref, onValue } from "firebase/database";
import Link from "next/link";
import Profile from "./ProfileBadge";

const TopUsers = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const usersRef = ref(rtdb, "users");
    onValue(usersRef, (snapshot) => {
      let arr = [];
      snapshot.forEach((child) => {
        arr.push({
          uid: child.key,
          ...child.val()
        });
      });
      setUsers(arr);
    });
  }, []);

  if (!users) {
    return <div>Loading...</div>
  }
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-semibold text-text">
        Top Users</h2>
      <ul>
        {users.map((user,index) => (
          <li key={user.uid} className="fade-in" style={{ animationDelay: `${index * 50}ms` }}>
            <Profile uid={user.uid} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TopUsers;