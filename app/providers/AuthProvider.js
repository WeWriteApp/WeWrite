"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import { auth } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { rtdb } from "../firebase/rtdb";
import { ref, onValue } from "firebase/database";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User is logged in', user);
        // get the user's preferences
        const uid = user.uid;
        const userRef = ref(rtdb, `users/${uid}`);

        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          let user = {
            ...data,
            uid: snapshot.key,
          };
          setUser(user);
        }); // Monitor the user ref for changes
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
