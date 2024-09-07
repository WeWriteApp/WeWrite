import { getDatabase, ref, push, get, set, update } from "firebase/database";
import { app } from "./config";
import { db } from "./database";
import { 
  getFirestore,
  collection,
  getDocs,
  query,
  createDoc,
  where
} from "firebase/firestore";

export const rtdb = getDatabase(app);

export const add = async (path, data) => {
  const dbRef = ref(rtdb, path);
  const newRef = push(dbRef);
  await set(newRef, data);
  return newRef;
}

export const updateData = async (path, data) => {
  const dbRef = ref(rtdb, path);
  await update(dbRef, data);
}

export const getDoc = async (path) => {
  const dbRef = ref(rtdb, path);
  const snapshot = await get(dbRef);
  return snapshot.val();
}

export const setDoc = async (path, data) => {
  const dbRef = ref(rtdb, path);
  await set(dbRef, data);
}

export const removeDoc = async (path) => {
  const dbRef = ref(rtdb, path);
  await set(dbRef, null);
}

export const addPagesToUser = async (userId) => {
  // get pages from firestore by userId
  const q = query(collection(db, "pages"), where("userId", "==", userId));
  const pages = await getDocs(q);

  // add pages to the user in rtdb
  const userPagesRef = ref(rtdb, `users/${userId}/pages`);
  let data = {};
  pages.docs.forEach((doc) => {
    data[doc.id] = doc.data();
  });
  await set(userPagesRef, data);
  
}