/**
 * Utility to ensure authentication is properly maintained across the application
 * This is especially important after account switching
 */

import Cookies from 'js-cookie';
import { auth } from "../firebase/auth';

/**
 * Ensures that the current user's authentication is properly set up
 * This should be called before any operation that requires authentication
 */
export const ensureAuth = () => {
  console.log('Ensuring authentication is properly set up...');
  
  // Check if we have a Firebase auth user
  const firebaseUser = auth.currentUser;
  
  if (firebaseUser) {
    console.log('Firebase auth user found:', firebaseUser.email);
    return true;
  }
  
  // Check for our wewrite cookies
  const wewriteUserId = Cookies.get('wewrite_user_id');
  const wewriteAuthenticated = Cookies.get('wewrite_authenticated') === 'true';
  
  if (wewriteUserId && wewriteAuthenticated) {
    console.log('WeWrite session authentication found for user ID:', wewriteUserId);
    
    // Ensure the userSession cookie is set
    const userSessionCookie = Cookies.get('userSession');
    
    if (!userSessionCookie) {
      // Try to get account data from sessionStorage
      try {
        const accountsJson = sessionStorage.getItem('wewrite_accounts');
        
        if (accountsJson) {
          const accounts = JSON.parse(accountsJson);
          const account = accounts.find(acc => acc.uid === wewriteUserId);
          
          if (account) {
            // Set the userSession cookie
            Cookies.set('userSession', JSON.stringify({
              uid: account.uid,
              email: account.email,
              username: account.username
            }), { expires: 7 });
            
            console.log('Set userSession cookie from wewrite_accounts data');
          }
        }
      } catch (error) {
        console.error('Error setting userSession cookie:', error);
      }
    }
    
    // Also set the authenticated cookie for backward compatibility
    if (Cookies.get('authenticated') !== 'true') {
      Cookies.set('authenticated', 'true', { expires: 7 });
      console.log('Set authenticated cookie for backward compatibility');
    }
    
    return true;
  }
  
  // Check for older authentication methods
  const authenticated = Cookies.get('authenticated') === 'true';
  const userSession = Cookies.get('userSession');
  
  if (authenticated && userSession) {
    console.log('Legacy session authentication found');
    
    // Set our new cookies for forward compatibility
    try {
      const sessionData = JSON.parse(userSession);
      
      if (sessionData && sessionData.uid) {
        Cookies.set('wewrite_user_id', sessionData.uid, { expires: 7 });
        Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
        
        console.log('Set wewrite cookies from legacy session data');
      }
    } catch (error) {
      console.error('Error setting wewrite cookies:', error);
    }
    
    return true;
  }
  
  console.log('No authentication found");
  return false;
};

export default ensureAuth;
