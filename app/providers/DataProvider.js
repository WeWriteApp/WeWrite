"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext,useContext } from "react";
import { AuthContext } from "./AuthProvider";
import { app } from "../firebase/config";
import {
  set,
  getDatabase,
  ref,
  onValue,
} from "firebase/database";
import { 
  getFirestore,
  collection,
  getDocs,
  query,
  createDoc,
  where
} from "firebase/firestore";

export const db = getFirestore(app);
export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [groups, setGroups] = useState([]);
  const { user } = useContext(AuthContext);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (user) {
      fetchPages();
    } else {
      setPages([]);
      setLoading(false);
    }
  }, [user]);

  const fetchPages = async () => {
    // console.log("fetching pages");  
    // const q = query(collection(db, "pages"), where("userId", "==", user.uid));
    // const pages = await getDocs(q);
    // setPages(pages.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    // setLoading(false);

    // user.pages now exists on user object
    let pagesArray = [];
    for (const [key, value] of Object.entries(user.pages)) {
      pagesArray.push({
        id: key,
        ...value
      });
    }

    let count = pagesArray.length;
    setPages(pagesArray);

    // set filtered to the titles of the pages with ID for link
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

  // a way for a delete method to update the state
  const deletePageState = (id) => {
    fetchPages();
  };

  return (
    <DataContext.Provider value={{ loading, pages,deletePageState,fetchPages,filtered }}>
      {children}
    </DataContext.Provider>
  );
};
