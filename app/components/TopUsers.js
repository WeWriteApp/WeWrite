"use client";
import React, { useState, useEffect} from "react";
import Link from "next/link";
import Image from "next/image";
import { AuthContext } from "../providers/AuthProvider";
import { useContext } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const TopUsers = () => {
  const [users, setUsers] = useState([]);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchUsersAndPages = async () => {
      const db = getDatabase();
      const firestore = getFirestore();
      const usersRef = ref(db, 'users');

      onValue(usersRef, async (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const pageCounts = {};
          const pagesRef = collection(firestore, 'pages');
          const pagesSnapshot = await getDocs(pagesRef);
          
          pagesSnapshot.forEach((doc) => {
            const userId = doc.data().userId;
            if (userId) {
              pageCounts[userId] = (pageCounts[userId] || 0) + 1;
            }
          });

          const usersArray = Object.entries(data).map(([id, userData]) => ({
            id,
            username: userData.username || userData.displayName || "NULL",
            photoURL: userData.photoURL,
            pageCount: pageCounts[id] || 0
          }));
          
          const sortedUsers = usersArray.sort((a, b) => b.pageCount - a.pageCount);
          setUsers(sortedUsers);
        }
      });
    };

    fetchUsersAndPages();
  }, []);

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-text">Top Users</h2>
      <div className="flex flex-wrap gap-2">
        {users.map((user) => {
          const hasPages = user.pageCount > 0;
          return (
            <Link
              key={user.id}
              href={`/user/${user.id}`}
              className={
                hasPages 
                  ? "bg-[#1D4ED8] text-white hover:bg-[#1e40af] px-4 py-2 rounded-full transition-colors"
                  : "dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 px-4 py-2 rounded-full transition-colors"
              }
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
                <span>{user.username || "NULL"} ({user.pageCount})</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default TopUsers;