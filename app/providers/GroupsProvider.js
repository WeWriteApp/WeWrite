"use client";
import React, { useState, useEffect } from "react";
import database, { ref, onValue } from "../firebase/rtdb";

export const GroupsContext = React.createContext();

export const GroupsProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const groupsRef = ref(database, "groups");
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
