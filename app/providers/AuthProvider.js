"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useContext, createContext, useState, useEffect } from "react";
import { auth, app } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getDatabase, ref, onValue, update } from "firebase/database";
import Cookies from 'js-cookie';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        setUser(user);
        // Set session cookie
        const token = await user.getIdToken();
        Cookies.set('session', token, { expires: 7 }); // 7 days expiry
      } else {
        // User is signed out
        setUser(null);
        // Remove session cookie
        Cookies.remove('session');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  const value = {
    user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
