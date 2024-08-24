"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext,useContext } from "react";
import { AuthContext } from "./AuthProvider";
import { app } from "../firebase/config";
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
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (user) {
      fetchPages();
      setLoading(false);
    } else {
      setPages([]);
      setLoading(false);
    }
  }, [user]);

  const fetchPages = async () => {
    setLoading(true);
    const db = getFirestore(app);
    const q = query(collection(db, "pages"), where("userId", "==", user.uid));
    const pages = await getDocs(q);
    setPages(pages.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // a way for a delete method to update the state
  const deletePageState = (id) => {
    fetchPages();
  };

  return (
    <DataContext.Provider value={{ loading, pages,deletePageState,fetchPages }}>
      {children}
    </DataContext.Provider>
  );
};
