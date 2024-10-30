// src/hooks/useuserSearch.ts
import { rtdb } from "@/firebase/rtdb";
import { onValue, ref } from "firebase/database";
import { useState } from "react";

export const useUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const userSearch = async (keyword: string) => {
    setLoading(true);
    setError(null);

    console.log("keyword", keyword)

    try {
      const usersRef = ref(rtdb, "users");
      onValue(usersRef, (snapshot) => {
        let arr: any = [];
        snapshot.forEach((child) => {
          arr.push({
            uid: child.key,
            ...child.val()
          });
        });

        setUsers(arr.filter((item: any) => item?.username?.toLowerCase().includes(keyword.toLowerCase()) || item?.email?.toLowerCase().includes(keyword.toLowerCase())))
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () =>{
    setUsers([])
  }

  return { users, loading, error, userSearch, clear };
};
