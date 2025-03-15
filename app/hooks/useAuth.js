"use client";
import { useState, useEffect } from "react";
import { auth } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, getDatabase, update } from "firebase/database";
import app from "../firebase/config";

const LOADING_TIMEOUT = 5000; // 5 seconds timeout for loading states

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
        }
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
    let mounted = true;
    let timeoutId = null;
    
    // Set initial loading state
    setLoading(true);
    setError(null);

    // Set a timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
        setError('Auth state took too long to resolve');
      }
    }, LOADING_TIMEOUT);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      try {
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
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }
    }, (error) => {
      console.error('Auth state change error:', error);
      if (mounted) {
        setError(error.message);
        setLoading(false);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    });

    // Cleanup function
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
} 