// Clear all authentication cookies for local development
// Run this in browser console: copy and paste this entire script

console.log('🧹 Clearing all authentication cookies...');

// List of all possible auth-related cookies
const authCookies = [
  'session',
  'authenticated',
  'userSession', 
  'simpleUserSession',
  'user_email',
  'sessionToken',
  'authToken',
  'firebase-auth-token',
  '__session'
];

// Clear each cookie
authCookies.forEach(cookieName => {
  // Clear for current domain
  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;
  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  
  console.log(`✅ Cleared cookie: ${cookieName}`);
});

// Clear localStorage
console.log('🧹 Clearing localStorage...');
localStorage.clear();

// Clear sessionStorage  
console.log('🧹 Clearing sessionStorage...');
sessionStorage.clear();

console.log('✅ All auth data cleared! Refreshing page...');

// Refresh the page
setTimeout(() => {
  window.location.reload();
}, 1000);
