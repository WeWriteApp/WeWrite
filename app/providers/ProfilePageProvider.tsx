import React, { createContext, ReactNode } from "react";
import useSimplePages from "../hooks/useSimplePages";
import { useAuth } from "./AuthProvider";
// Types
interface ProfilePagesProviderProps {
  userId: string;
  children: ReactNode;
}

// Note: The context type will be inferred from usePages hook return type
export const ProfilePagesContext = createContext<any>(undefined);

export const ProfilePagesProvider = ({ userId, children }: ProfilePagesProviderProps) => {
  const { user } = useAuth();
  // Use simple API-based hook instead of broken Firestore queries
  const pagesData = useSimplePages(userId, user?.uid || null, true);

  return (
    <ProfilePagesContext.Provider value={pagesData}>
      {children}
    </ProfilePagesContext.Provider>
  );
};