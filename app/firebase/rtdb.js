import {
  getDatabase,
  ref,
  push,
  onValue,
  get,
  set,
  update,
} from "firebase/database";
import { app } from "./config";

export const rtdb = getDatabase(app);

export const add = async (path, data) => {
  const dbRef = ref(rtdb, path);
  const newRef = push(dbRef);
  await set(newRef, data);
  return newRef;
};

export const updateData = async (path, data) => {
  const dbRef = ref(rtdb, path);
  await update(dbRef, data);
};

export const getDoc = async (path) => {
  const dbRef = ref(rtdb, path);
  const snapshot = await get(dbRef);
  return snapshot.val();
};

export const setDoc = async (path, data) => {
  const dbRef = ref(rtdb, path);
  await set(dbRef, data);
};

export const removeDoc = async (path) => {
  const dbRef = ref(rtdb, path);
  await set(dbRef, null);
};

export const fetchGroupFromFirebase = async (groupId) => {
  try {
    const groupRef = ref(rtdb, `groups/${groupId}`);
    const snapshot = await get(groupRef);
    return {
      id: snapshot.key,
      ...snapshot.val(),
    }
  } catch (error) {
    console.error("Error fetching group from Firebase", error);
    return null;
  }
};

export const fetchProfileFromFirebase = async (userId) => {
  try {
    const profileRef = ref(rtdb, `users/${userId}`);
    const snapshot = await get(profileRef);
    return {
      uid: snapshot.key,
      ...snapshot.val(),
    }
  } catch (error) {
    console.error("Error fetching profile from Firebase", error);
    return null;
  }
}