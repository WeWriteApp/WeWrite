"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';
import NewPage from "./page";

/**
 * This is a wrapper component that ensures authentication before rendering the New Page component.
 * It directly checks cookies and sessionStorage to determine if the user is authenticated,
 * without relying on the AuthContext or other utilities that might not be updated correctly.
 */
export default function NewPageWrapper() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Direct check for authentication without relying on utilities
    const checkAuth = () => {
      console.log("Direct authentication check in NewPageWrapper");
      
      // Check for our wewrite cookies
      const wewriteUserId = Cookies.get('wewrite_user_id');
      const wewriteAuthenticated = Cookies.get('wewrite_authenticated') === 'true';
      
      // Check for older authentication methods
      const authenticated = Cookies.get('authenticated') === 'true';
      const userSessionCookie = Cookies.get('userSession');
      
      console.log("Authentication cookies:", {
        wewriteUserId,
        wewriteAuthenticated,
        authenticated,
        hasUserSession: !!userSessionCookie
      });
      
      // If we have a wewrite user ID, try to get the user data from sessionStorage
      if (wewriteUserId) {
        setUserId(wewriteUserId);
        
        try {
          const accountsJson = sessionStorage.getItem('wewrite_accounts');
          if (accountsJson) {
            const accounts = JSON.parse(accountsJson);
            const account = accounts.find(acc => acc.uid === wewriteUserId);
            
            if (account) {
              console.log("Found user data in sessionStorage:", account);
              setUserData(account);
              setIsAuthenticated(true);
              setIsLoading(false);
              return true;
            }
          }
        } catch (error) {
          console.error("Error getting user data from sessionStorage:", error);
        }
      }
      
      // If we have a userSession cookie, try to get the user data from it
      if (userSessionCookie) {
        try {
          const userSession = JSON.parse(userSessionCookie);
          
          if (userSession && userSession.uid) {
            console.log("Found user data in userSession cookie:", userSession);
            setUserId(userSession.uid);
            setUserData(userSession);
            setIsAuthenticated(true);
            setIsLoading(false);
            return true;
          }
        } catch (error) {
          console.error("Error parsing userSession cookie:", error);
        }
      }
      
      // If we have authenticated cookie but no user data, we're in a weird state
      if (authenticated || wewriteAuthenticated) {
        console.log("Found authenticated cookie but no user data");
        
        // Try to get user data from localStorage as a last resort
        try {
          const switchToAccount = localStorage.getItem('switchToAccount');
          if (switchToAccount) {
            const account = JSON.parse(switchToAccount);
            
            if (account && account.uid) {
              console.log("Found user data in localStorage:", account);
              setUserId(account.uid);
              setUserData(account);
              setIsAuthenticated(true);
              setIsLoading(false);
              return true;
            }
          }
        } catch (error) {
          console.error("Error getting user data from localStorage:", error);
        }
        
        // If we still don't have user data, redirect to login
        console.log("No user data found, redirecting to login");
        setIsAuthenticated(false);
        setIsLoading(false);
        return false;
      }
      
      // If we get here, we're not authenticated
      console.log("Not authenticated, redirecting to login");
      setIsAuthenticated(false);
      setIsLoading(false);
      return false;
    };
    
    // Check authentication and redirect if needed
    const isAuth = checkAuth();
    
    if (!isAuth) {
      // Set a timeout to avoid immediate redirect
      const timeout = setTimeout(() => {
        router.push('/auth/login');
      }, 100);
      
      return () => clearTimeout(timeout);
    }
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
  
  // If authenticated, render the New Page component
  if (isAuthenticated && userId && userData) {
    // Force set cookies to ensure they're available to the New Page component
    Cookies.set('wewrite_user_id', userId, { expires: 7 });
    Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
    Cookies.set('authenticated', 'true', { expires: 7 });
    
    // Set userSession cookie if it doesn't exist
    if (!Cookies.get('userSession')) {
      Cookies.set('userSession', JSON.stringify(userData), { expires: 7 });
    }
    
    // Inject the user data into sessionStorage
    try {
      let accounts = [];
      const accountsJson = sessionStorage.getItem('wewrite_accounts');
      
      if (accountsJson) {
        accounts = JSON.parse(accountsJson);
        
        // Update or add the current user
        const existingIndex = accounts.findIndex(acc => acc.uid === userId);
        
        if (existingIndex >= 0) {
          accounts[existingIndex] = { ...accounts[existingIndex], ...userData, isCurrent: true };
        } else {
          accounts.push({ ...userData, isCurrent: true });
        }
      } else {
        accounts = [{ ...userData, isCurrent: true }];
      }
      
      sessionStorage.setItem('wewrite_accounts', JSON.stringify(accounts));
    } catch (error) {
      console.error("Error updating sessionStorage:", error);
    }
    
    console.log("Authentication successful, rendering New Page component");
    return <NewPage forcedUser={userData} />;
  }
  
  // This should never happen, but just in case
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="text-muted-foreground">Unable to verify your authentication. Please try logging in again.</p>
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
