"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext } from "react";
import {getCollection} from "../firebase/database";
import { app2 } from "../firebase/config";
import { 
  getFirestore,
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc
} from "firebase/firestore";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    async function fetchData() {
      await fetchPages();

      setLoading(false);
    }
    fetchData();
    // Handle destroy here
    return () => {
      // Cleanup code for destroy
      
    };
  }, []);

  const fetchPages = async () => {
    const pages = await getCollection("pages");
    setPages(pages.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // a way for a delete method to update the state
  const deletePageState = (id) => {
    // refetch pages
    fetchPages();
  };

  return (
    <DataContext.Provider value={{ loading, pages,deletePageState,fetchPages }}>
      {children}
    </DataContext.Provider>
  );
};
