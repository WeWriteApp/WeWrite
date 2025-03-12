"use client";
import React, { useState, useEffect} from "react";
import Image from "next/image";
import { AuthContext } from "../providers/AuthProvider";
import { useContext } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { PillLink } from "./PillLink";

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
            <PillLink
              key={user.id}
              href={`/user/${user.id}`}
              className={!hasPages ? 'opacity-50' : ''}
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
            </PillLink>
          );
        })}
      </div>
    </div>
  );
};

export default TopUsers;