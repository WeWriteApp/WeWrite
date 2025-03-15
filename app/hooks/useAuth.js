"use client";
import { useState, useEffect } from "react";
import { auth } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, getDatabase, update } from "firebase/database";
import app from "../firebase/config";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getUserFromRTDB = async (user) => {
    if (!user?.uid) return null;
    
    const db = getDatabase(app);
    const dbRef = ref(db, `users/${user.uid}`);

    try {
      const snapshot = await get(dbRef);
      const data = snapshot.val() || {};

      if (!data.username && user.displayName) {
        await update(ref(db), {
          [`users/${user.uid}/username`]: user.displayName
        });
        data.username = user.displayName;
      }

      return {
        uid: user.uid,
        email: user.email,
        ...data
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return {
        uid: user.uid,
        email: user.email
      };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userData = await getUserFromRTDB(user);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
} 