"use client";
import { useEffect, useState, createContext } from "react";

export const AuthContext = createContext();

// Mock user data for testing without Firebase
const mockUser = {
  uid: 'mock-user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  username: 'Test User'
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(mockUser);  // Initialize with mock user
  const [loading, setLoading] = useState(false);  // Set loading to false initially

  // No Firebase auth effect needed for testing
  useEffect(() => {
    // Mock authentication is already set up
    console.log('Mock user is logged in', mockUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
