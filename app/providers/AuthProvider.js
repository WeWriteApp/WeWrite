"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import { auth } from "../firebase/auth";
import  app  from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get, set, getDatabase } from "firebase/database";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
