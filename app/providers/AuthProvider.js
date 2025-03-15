"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useContext, createContext, useState, useEffect } from "react";
import { auth, app } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getDatabase, ref, onValue, update } from "firebase/database";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previousAuthState, setPreviousAuthState] = useState(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('User is logged in', user);
          // Only redirect if this is a new login (user was previously null)
          if (!previousAuthState) {
            router.push('/pages');
          }
          setPreviousAuthState(user);
          getUserFromRTDB(user);
        } else {    
          setUser(null);
          setLoading(false);
          setPreviousAuthState(null);
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('Auth state change error:', error);
      setLoading(false);
    }
  }, [router]);

  const getUserFromRTDB = (user) => {
    const db = getDatabase(app);
    let uid = user.uid;
    const dbRef = ref(db, `users/${uid}`);
    
    onValue(dbRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        // Handle case where user data doesn't exist yet
        setUser({
          uid: user.uid,
          email: user.email,
          username: user.displayName || ''
        });
        setLoading(false);
        return;
      }

      if (!data.username && user.displayName) {
        let updates = {};
        updates[`users/${uid}/username`] = user.displayName;
        update(ref(db), updates);
        data.displayName = user.displayName;
      } else if (data.username !== user.displayName) {
        let updates = {};
        updates[`users/${uid}/username`] = user.displayName;
        update(ref(db), updates);
        data.username = user.displayName;
      }

      setUser({
        uid: user.uid,
        email: user.email,
        ...data
      });
      setLoading(false);
    });
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
