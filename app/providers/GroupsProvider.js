"use client";
import React, { useState, useEffect } from "react";
import { rtdb, ref, onValue } from "../firebase/rtdb";

export const GroupsContext = React.createContext();

export const GroupsProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);

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
