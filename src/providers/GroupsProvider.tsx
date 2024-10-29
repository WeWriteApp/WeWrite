"use client";
import React, { useState, useEffect, ReactNode, createContext } from "react";
import { rtdb } from "../firebase/rtdb";
import { onValue, ref } from "firebase/database";


interface GroupsContextType {
  groups?: any[];
}

interface GroupsProviderProps {
  children: ReactNode;
}

export const GroupsContext = createContext<GroupsContextType>({});

export const GroupsProvider: React.FC<GroupsProviderProps> = ({ children }) => {


  const [groups, setGroups] = useState<any>([]);

  useEffect(() => {
    const groupsRef = ref(rtdb, "groups");
    return onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setGroups(arr);
      } else {
        setGroups([]);
      }

    });
  }, []);

  return (
    <GroupsContext.Provider value={groups}>
      {children}
    </GroupsContext.Provider>
  );
}