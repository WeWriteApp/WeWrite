import React, { createContext, ReactNode } from "react";
import useUserPages from "../hooks/useUserPages";
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
  // Fetch user's pages via API
  const pagesData = useUserPages(userId, user?.uid || null, true);

  return (
    <ProfilePagesContext.Provider value={pagesData}>
      {children}
    </ProfilePagesContext.Provider>
  );
};