"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import { auth } from "../firebase/auth";
import  app  from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get, set, getDatabase,update } from "firebase/database";
import { useRouter } from "next/navigation";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User is logged in', user);
        getUserFromRTDB(user);

      } else {    
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const getUserFromRTDB =  (user) => {
    const db = getDatabase(app);

    let uid = user.uid;
    const dbRef = ref(db, `users/${uid}`);
    // get the user from the database
    onValue(dbRef, (snapshot) => {
      const data = snapshot.val();

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
    <AuthContext.Provider value={{ user, loading, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
