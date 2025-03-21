"use client";
import React, { useState, useEffect} from "react";
import Image from "next/image";
import { AuthContext } from "../providers/AuthProvider";
import { useContext } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { PillLink } from "./PillLink";
import { Loader } from "lucide-react";

const TopUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchUsersAndPages = async () => {
      setLoading(true);
      try {
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
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        setLoading(false);
      }
    };

    fetchUsersAndPages();
  }, []);

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-2 text-text">Leaderboard</h2>
      <p className="text-sm text-gray-400 mb-4">These are the users who've written the most pages. More leaderboards coming soon!</p>
      
      {loading ? (
        <div className="flex items-center justify-center h-20 bg-background/50 rounded-xl border border-border">
          <Loader className="h-5 w-5 text-foreground/70 animate-spin mr-2" />
          <span className="text-foreground/70">Loading leaderboard data...</span>
        </div>
      ) : (
        <div className="flex flex-wrap">
          {users.map((user) => {
            const hasPages = user.pageCount > 0;
            return (
              <div key={user.id} className="m-0.5">
                <PillLink
                  href={`/user/${user.id}`}
                  className={!hasPages ? 'opacity-50' : ''}
                >
                  <div className="flex items-center gap-1">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopUsers;