"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
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
        // Try to get user data from sessionStorage
        try {
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const currentAccount = accounts.find(acc => acc.isCurrent);
            
            if (currentAccount) {
              console.log("DirectCreatePage: Using current account from sessionStorage:", currentAccount);
              setUser(currentAccount);
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error("DirectCreatePage: Error getting user data from sessionStorage:", error);
        }
        
        // If we get here, we're not authenticated
        console.log("DirectCreatePage: No user found, redirecting to login");
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
