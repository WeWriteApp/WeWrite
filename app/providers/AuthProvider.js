"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext, useRef } from "react";
import { auth } from "../firebase/auth";
import app from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, getDatabase, update } from "firebase/database";
import { usePathname } from "next/navigation";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const isInitialMount = useRef(true);

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
    let mounted = true;

    const handleUser = async (user) => {
      try {
        if (user) {
          const userData = await getUserFromRTDB(user);
          if (mounted) {
            setUser(userData);
            setLoading(false);
            
            if (!isInitialMount.current && pathname?.includes('/auth/')) {
              window.location.href = '/';
            }
          }
        } else {
          if (mounted) {
            setUser(null);
            setLoading(false);
            
            if (!isInitialMount.current && pathname && !pathname.includes('/auth/')) {
              window.location.href = '/auth/login';
            }
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, handleUser);

    if (isInitialMount.current) {
      isInitialMount.current = false;
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
