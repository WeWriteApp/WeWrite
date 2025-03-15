"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import { auth } from "../firebase/auth";
import  app  from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get, set, getDatabase,update } from "firebase/database";
import { useRouter, usePathname } from "next/navigation";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          console.log('User is logged in', user);
          await getUserFromRTDB(user);
          
          // Only redirect if we're on an auth page and not already navigating
          if (pathname?.includes('/auth/')) {
            setTimeout(() => {
              router.push('/');
            }, 0);
          }
        } else {    
          setUser(null);
          setLoading(false);
          
          // Only redirect to login if we're not already on an auth page and not already navigating
          if (pathname && !pathname.includes('/auth/')) {
            setTimeout(() => {
              router.push('/auth/login');
            }, 0);
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  const getUserFromRTDB = async (user) => {
    const db = getDatabase(app);
    const uid = user.uid;
    const dbRef = ref(db, `users/${uid}`);

    try {
      const snapshot = await get(dbRef);
      const data = snapshot.val() || {};

      if (!data.username && user.displayName) {
        await update(ref(db), {
          [`users/${uid}/username`]: user.displayName
        });
        data.username = user.displayName;
      }

      setUser({
        uid: user.uid,
        email: user.email,
        ...data
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser({
        uid: user.uid,
        email: user.email
      });
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
