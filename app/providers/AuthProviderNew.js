"use client";

import { useContext, createContext, useState, useEffect } from "react";
import { auth } from "../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { rtdb } from "../../firebase/rtdb";
import Cookies from 'js-cookie';
import AuthManager from "../../utils/AuthManager";

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProviderNew = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log("Setting up auth state listener");

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser ? "User logged in" : "User logged out");

      if (firebaseUser) {
        // User is signed in to Firebase
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

          let userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: firebaseUser.displayName || '',
          };

          if (userDoc.exists()) {
            // Merge Firestore data with Firebase auth data
            userData = {
              ...userData,
              ...userDoc.data(),
            };
            console.log("User data from Firestore:", userDoc.data());
          } else {
            // Create a user document if it doesn't exist
            await setDoc(doc(db, "users", firebaseUser.uid), {
              email: firebaseUser.email,
              username: firebaseUser.displayName || '',
              createdAt: new Date().toISOString()
            });
          }

          // Update user's last login timestamp
          const rtdbUserRef = ref(rtdb, `users/${firebaseUser.uid}`);
          update(rtdbUserRef, {
            lastLogin: new Date().toISOString(),
          });

          // Set user state
          setUser(userData);

          // Save account to AuthManager
          AuthManager.saveAccount(userData);
        } catch (error) {
          console.error("Error loading user data:", error);
          
          // Set minimal user data
          const minimalUserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: firebaseUser.displayName || '',
          };
          
          setUser(minimalUserData);
          
          // Save minimal account to AuthManager
          AuthManager.saveAccount(minimalUserData);
        }
      } else {
        // User is signed out of Firebase
        // Check if we have a session-based user
        const sessionUser = AuthManager.getCurrentAccount();
        
        if (sessionUser) {
          console.log("Using session-based user:", sessionUser.email);
          setUser(sessionUser);
        } else {
          // No user signed in
          setUser(null);
        }
      }

      setLoading(false);
    });

    return () => {
      console.log("Cleaning up auth state listener");
      unsubscribe();
    };
  }, [router]);

  // Check for session-based authentication when Firebase auth changes
  useEffect(() => {
    if (!user && !loading) {
      // If no Firebase user and not loading, check for session user
      const sessionUser = AuthManager.getCurrentAccount();
      
      if (sessionUser) {
        console.log("Using session-based user after auth state change:", sessionUser.email);
        setUser(sessionUser);
      }
    }
  }, [user, loading]);

  const value = {
    user,
    loading,
    isAuthenticated: AuthManager.isAuthenticated()
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
