"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";

export const CommunityContext = createContext();

export const CommunityProvider = ({ children }) => {
  return (
    <CommunityContext.Provider
      value={{
        
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
};
