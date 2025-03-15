"use client";
import { useState, useEffect } from "react";
import { auth } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, getDatabase, update } from "firebase/database";
import app from "../firebase/config";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getUserFromRTDB = async (user) => {
    if (!user?.uid) return null;
    
    const db = getDatabase(app);
    const dbRef = ref(db, `users/${user.uid}`);

    try {
      const snapshot = await get(dbRef);
      const data = snapshot.val() || {};

      // Only update username if it doesn't exist
      if (!data.username && user.displayName) {
        try {
          await update(ref(db), {
            [`users/${user.uid}/username`]: user.displayName
          });
          data.username = user.displayName;
        } catch (updateError) {
          console.error('Error updating username:', updateError);
          // Continue with existing data even if update fails
        }
      }

      return {
        uid: user.uid,
        email: user.email,
        ...data
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Return basic user data if DB fetch fails
      return {
        uid: user.uid,
        email: user.email
      };
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!mounted) return;

        if (firebaseUser) {
          const userData = await getUserFromRTDB(firebaseUser);
          if (mounted) {
            setUser(userData);
            setError(null);
          }
        } else {
          if (mounted) {
            setUser(null);
            setError(null);
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        if (mounted) {
          setUser(null);
          setError(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }, (error) => {
      console.error('Auth state change error:', error);
      if (mounted) {
        setError(error.message);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
} 