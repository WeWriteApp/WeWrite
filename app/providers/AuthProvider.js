"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useContext, createContext, useState, useEffect } from "react";
import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { rtdb } from "../firebase/rtdb";
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

  // Check for pending redirects and previous user sessions on component mount
  useEffect(() => {
    const hasPendingRedirect = localStorage.getItem('authRedirectPending') === 'true';
    const previousUserSession = localStorage.getItem('previousUserSession');

    if (hasPendingRedirect && auth.currentUser) {
      console.log('Found pending redirect with authenticated user, handling now...');
      localStorage.removeItem('authRedirectPending');
      router.push('/');
      router.refresh();
    } else if (previousUserSession && !auth.currentUser) {
      // If we have a previous user session but no current user,
      // we might be returning from an auth flow where the user canceled
      console.log('Returning from auth flow, restoring previous session...');
      try {
        // We don't actually log the user back in here, just show that we're preserving the session
        // In a real implementation, you would handle this with proper auth state management
        const prevUser = JSON.parse(previousUserSession);
        console.log('Previous user session found:', prevUser.username || prevUser.email);

        // Check if we're on the login page and redirect to home if needed
        if (window.location.pathname.includes('/auth/')) {
          console.log('On auth page with previous session, redirecting to home...');
          router.push('/');
        }
      } catch (error) {
        console.error('Error parsing previous user session:', error);
      }
    }
  }, [router]);

  useEffect(() => {
    console.log("Setting up auth state listener");
    // Add persistent state flag to detect auth changes across page loads
    const persistedAuthState = localStorage.getItem('authState');
    if (persistedAuthState === 'authenticated' && !user) {
      console.log("Found persisted auth state, waiting for full auth...");
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? "User logged in" : "User logged out");

      if (user) {
        // User is signed in
        localStorage.setItem('authState', 'authenticated');
        // Clear any previous user session since we have a new login
        localStorage.removeItem('previousUserSession');

        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Set user state with Firestore data
            setUser({
              uid: user.uid,
              email: user.email,
              username: userData.username || user.displayName || '',
              ...userData
            });

            // Log the user data for debugging
            console.log("User data from Firestore:", userData);
          } else {
            // No user document, create default data
            setUser({
              uid: user.uid,
              email: user.email,
              username: user.displayName || '',
            });

            // Create a user document if it doesn't exist
            await setDoc(doc(db, "users", user.uid), {
              email: user.email,
              username: user.displayName || '',
              createdAt: new Date().toISOString()
            });
          }

          // Update user's last login timestamp
          const rtdbUserRef = ref(rtdb, `users/${user.uid}`);
          update(rtdbUserRef, {
            lastLogin: new Date().toISOString(),
          });

          // Set session cookie
          const token = await user.getIdToken();
          Cookies.set('session', token, { expires: 7 }); // 7 days expiry
          Cookies.set('authenticated', 'true', { expires: 7 });
        } catch (error) {
          console.error("Error loading user data:", error);
          setUser({
            uid: user.uid,
            email: user.email,
            username: user.displayName || '',
          });
        }
      } else {
        // User is signed out
        localStorage.removeItem('authState');
        // Check if we have a previous user session
        const previousUserSession = localStorage.getItem('previousUserSession');

        if (previousUserSession) {
          // We're in the process of switching accounts, don't fully clear the user state
          console.log('Previous user session found, maintaining partial state for account switching');
          // We still need to clear cookies for proper auth state
          Cookies.remove('session');
          Cookies.remove('authenticated');
        } else {
          // Normal logout, clear everything
          setUser(null);
          // Remove session cookie
          Cookies.remove('session');
          Cookies.remove('authenticated');
        }
      }

      setLoading(false);
    });

    return () => {
      console.log("Cleaning up auth state listener");
      unsubscribe();
    };
  }, [router]);

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
