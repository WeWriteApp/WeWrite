"use client";
import React, { useState, useEffect} from "react";
import Link from "next/link";
import Image from "next/image";
import { AuthContext } from "../providers/AuthProvider";
import { useContext } from "react";
import { getDatabase, ref, onValue } from "firebase/database";

const TopUsers = () => {
  const [users, setUsers] = useState([]);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const db = getDatabase();
    const usersRef = ref(db, 'users');

    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersArray = Object.entries(data).map(([id, userData]) => ({
          id,
          username: userData.username || userData.displayName || "NULL",
          photoURL: userData.photoURL,
        }));
        
        setUsers(usersArray);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUserClick = (userId) => {
    console.log('Navigating to:', `/user/${userId}`);
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-text">Top Users</h2>
      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/user/${user.id}`}
            className="bg-[#1D4ED8] text-white px-4 py-2 rounded-full hover:bg-[#1e40af] transition-colors"
          >
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <Image
                  src={user.photoURL}
                  alt={user.username || "NULL"}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>{user.username || "NULL"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TopUsers;