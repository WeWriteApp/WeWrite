"use client";

/**
 * Development Authentication Panel
 * 
 * This component provides an easy interface for testing with development
 * authentication when USE_DEV_AUTH=true is set in the environment.
 * 
 * It shows available test users and provides quick login buttons.
 */

import React, { useState, useEffect } from 'react';
import { 
  getAuthEnvironmentInfo, 
  isDevelopmentAuthActive,
  devAuthHelpers 
} from '../../firebase/authWrapper';
import { DEV_TEST_USERS } from '../../firebase/developmentAuth';

interface DevelopmentAuthPanelProps {
  className?: string;
}

export const DevelopmentAuthPanel: React.FC<DevelopmentAuthPanelProps> = ({ 
  className = '' 
}) => {
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Get auth environment info
    const info = getAuthEnvironmentInfo();
    setAuthInfo(info);

    // Check if development auth is active
    if (!isDevelopmentAuthActive()) {
      return;
    }

    // Listen for auth state changes
    const { getGlobalAuthWrapper } = require('../../firebase/authWrapper');
    const authWrapper = getGlobalAuthWrapper();
    
    const unsubscribe = authWrapper.onAuthStateChanged((user: any) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const handleTestUserLogin = async (userKey: keyof typeof DEV_TEST_USERS) => {
    setIsLoading(true);
    try {
      await devAuthHelpers.signInAsTestUser1();
      console.log(`Signed in as ${userKey}`);
    } catch (error) {
      console.error('Error signing in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log('🔴 DEV AUTH PANEL: Logout button clicked');
    setIsLoading(true);
    try {
      console.log('🔴 DEV AUTH PANEL: Getting auth wrapper...');
      const { getAuthWrapper } = require('../../firebase/authWrapper');
      const authWrapper = getAuthWrapper();
      console.log('🔴 DEV AUTH PANEL: Auth wrapper obtained, calling signOut...');
      await authWrapper.signOut();
      console.log('🔴 DEV AUTH PANEL: SignOut completed successfully');
    } catch (error) {
      console.error('🔴 DEV AUTH PANEL: Error signing out:', error);
    } finally {
      setIsLoading(false);
      console.log('🔴 DEV AUTH PANEL: Logout process finished');
    }
  };

  // Don't render if not in development auth mode
  if (!authInfo?.isDevelopmentAuth) {
    return null;
  }

  return (
    <div className={`bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧪</span>
        <h3 className="text-lg font-semibold text-yellow-800">
          Development Authentication
        </h3>
      </div>
      
      <div className="text-sm text-yellow-700 mb-4">
        <p>You're using isolated test authentication. This prevents mixing test data with production accounts.</p>
        <p className="mt-1"><strong>Environment:</strong> {authInfo.environment}</p>
        <p><strong>Auth Type:</strong> {authInfo.authType}</p>
      </div>

      {currentUser ? (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-800 font-medium">✅ Signed in as:</p>
              <p className="text-green-700 text-sm">
                {currentUser.email}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                {isExpanded ? 'Hide' : 'Switch User'}
              </button>
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50"
              >
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Show user list when not logged in OR when logged in and expanded */}
      {(!currentUser || isExpanded) && (
        <div className="space-y-2">
          <p className="text-yellow-800 font-medium">
            {currentUser ? 'Switch to Different User:' : 'Quick Test User Login:'}
          </p>
          
          {Object.entries(DEV_TEST_USERS).map(([key, user]) => (
            <div key={key} className="flex items-center justify-between bg-white rounded p-3 border hover:border-blue-200 transition-colors">
              <div className="text-sm flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{user.username}</p>
                  {user.isAdmin && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Admin</span>
                  )}
                </div>
                <p className="text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-500">@{user.username}</p>
                {user.description && (
                  <p className="text-xs text-blue-600 mt-1">{user.description}</p>
                )}
              </div>
              <button
                onClick={() => handleTestUserLogin(key as keyof typeof DEV_TEST_USERS)}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 ml-3"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-yellow-200">
        <p className="text-xs text-yellow-600">
          💡 To disable development auth, remove <code>USE_DEV_AUTH=true</code> from your .env.local file
        </p>
      </div>
    </div>
  );
};

/**
 * Development Auth Status Indicator
 * Small indicator that shows when development auth is active
 */
export const DevelopmentAuthIndicator: React.FC = () => {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(isDevelopmentAuthActive());
  }, []);

  if (!isDev) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-medium shadow-lg">
      🧪 Dev Auth Active
    </div>
  );
};

export default DevelopmentAuthPanel;
