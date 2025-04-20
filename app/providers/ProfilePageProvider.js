import React, { createContext } from "react";
import usePages from "../hooks/usePages";

export const ProfilePagesContext = createContext();

export const ProfilePagesProvider = ({ userId, children }) => {
  const pagesData = usePages(userId, true, null, true); // Pass isUserPage=true to use higher limit

  return (
    <ProfilePagesContext.Provider value={pagesData}>
      {children}
    </ProfilePagesContext.Provider>
  );
};
