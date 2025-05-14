"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';

/**
 * AdminFeaturesWrapper
 * 
 * A component that wraps content and provides admin-specific features
 * for authorized admin users. For non-admin users, it simply renders
 * the children without any modifications.
 */
const AdminFeaturesWrapper = ({ children }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    // Check if the current user is an admin
    if (user && user.email === 'jamiegray2234@gmail.com') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // For non-admin users, simply render the children
  if (!isAdmin) {
    return <>{children}</>;
  }

  // For admin users, we could add special admin UI elements here
  return (
    <>
      {/* Admin-specific UI could be added here */}
      {children}
    </>
  );
};

export default AdminFeaturesWrapper;
