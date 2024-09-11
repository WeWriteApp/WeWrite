"use client";
import { useEffect, useState, createContext,useContext } from "react";
import { AuthContext } from "./AuthProvider";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const { user } = useContext(AuthContext);
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    if (user) {
      fetchPages();
    } else {
      setPages([]);
      setLoading(false);
    }
  }, [user]);

  const fetchPages = async () => {
    let pagesArray = [];
    for (const [key, value] of Object.entries(user.pages)) {
      pagesArray.push({
        id: key,
        ...value
      });
    }

    setPages(pagesArray);

    let filteredArray = [];
    pagesArray.forEach((page) => {
      filteredArray.push({
        id: page.id,
        name: page.title,
        isPublic: page.isPublic,
      });
    });

    setFiltered(filteredArray);
  };

  return (
    <DataContext.Provider value={{ loading, pages,fetchPages,filtered }}>
      {children}
    </DataContext.Provider>
  );
};
