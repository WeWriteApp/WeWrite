import React, { createContext, ReactNode } from "react";
import usePages from "../hooks/usePages";

// Types
interface ProfilePagesProviderProps {
  userId: string;
  children: ReactNode;
}

// Note: The context type will be inferred from usePages hook return type
export const ProfilePagesContext = createContext<any>(undefined);

export const ProfilePagesProvider = ({ userId, children }: ProfilePagesProviderProps) => {
  const pagesData = usePages(userId, true, null, true); // Pass isUserPage=true to use higher limit

  return (
    <ProfilePagesContext.Provider value={pagesData}>
      {children}
    </ProfilePagesContext.Provider>
  );
};
