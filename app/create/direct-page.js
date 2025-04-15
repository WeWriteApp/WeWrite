"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import Cookies from 'js-cookie';
import NewPageComponent from "../components/NewPageComponent";

/**
 * This is a simplified page creation component that directly uses Firebase auth
 * and bypasses all the complex authentication checks.
 */
export default function DirectCreatePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("DirectCreatePage: Setting up auth state listener");

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("DirectCreatePage: Auth state changed:", firebaseUser ? "User logged in" : "User logged out");

      if (firebaseUser) {
        // User is signed in to Firebase
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.displayName || '',
          displayName: firebaseUser.displayName || '',
        };

        console.log("DirectCreatePage: Using Firebase user:", userData);
        setUser(userData);
        setIsLoading(false);
      } else {
        // User is signed out of Firebase
        console.log("DirectCreatePage: Firebase user is signed out, checking other auth sources");

        // Try multiple sources for authentication data
        let userData = null;

        // 1. Try to get user data from wewrite_accounts in sessionStorage
        try {
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const currentAccount = accounts.find(acc => acc.isCurrent);

            if (currentAccount) {
              console.log("DirectCreatePage: Found current account in wewrite_accounts:", currentAccount);
              userData = currentAccount;
            }
          }
        } catch (error) {
          console.error("DirectCreatePage: Error getting user data from wewrite_accounts:", error);
        }

        // 2. Try to get user data from switchToAccount in localStorage
        if (!userData) {
          try {
            const switchToAccount = localStorage.getItem('switchToAccount');
            if (switchToAccount) {
              const account = JSON.parse(switchToAccount);
              if (account && account.uid) {
                console.log("DirectCreatePage: Found account in switchToAccount:", account);
                userData = account;
              }
            }
          } catch (error) {
            console.error("DirectCreatePage: Error getting user data from switchToAccount:", error);
          }
        }

        // 3. Try to get user data from wewrite_user_id cookie and wewrite_accounts
        if (!userData) {
          try {
            const wewriteUserId = Cookies.get('wewrite_user_id');
            if (wewriteUserId) {
              console.log("DirectCreatePage: Found wewrite_user_id cookie:", wewriteUserId);

              // Try to find the account in wewrite_accounts
              const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
              if (wewriteAccounts) {
                const accounts = JSON.parse(wewriteAccounts);
                const account = accounts.find(acc => acc.uid === wewriteUserId);

                if (account) {
                  console.log("DirectCreatePage: Found account in wewrite_accounts by user ID:", account);
                  userData = account;
                }
              }
            }
          } catch (error) {
            console.error("DirectCreatePage: Error getting user data from wewrite_user_id:", error);
          }
        }

        // 4. Try to get user data from userSession cookie
        if (!userData) {
          try {
            const userSessionCookie = Cookies.get('userSession');
            if (userSessionCookie) {
              const userSession = JSON.parse(userSessionCookie);
              if (userSession && userSession.uid) {
                console.log("DirectCreatePage: Found user data in userSession cookie:", userSession);
                userData = userSession;
              }
            }
          } catch (error) {
            console.error("DirectCreatePage: Error getting user data from userSession cookie:", error);
          }
        }

        // If we found user data from any source, use it
        if (userData) {
          console.log("DirectCreatePage: Using user data from alternative source:", userData);
          setUser(userData);
          setIsLoading(false);
          return;
        }

        // If we get here, we're not authenticated
        console.log("DirectCreatePage: No user found in any source, redirecting to login");
        setError("You must be logged in to create a page");
        setIsLoading(false);

        // Redirect to login page
        router.push('/auth/login');
      }
    });

    return () => {
      console.log("DirectCreatePage: Cleaning up auth state listener");
      unsubscribe();
    };
  }, [router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // If we have a user, render the New Page component
  if (user) {
    console.log("DirectCreatePage: Rendering NewPageComponent with user:", user);
    return <NewPageComponent forcedUser={user} />;
  }

  // This should never happen, but just in case
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Something Went Wrong</h1>
        <p className="text-muted-foreground">Unable to determine your authentication state. Please try again.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
