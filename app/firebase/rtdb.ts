import {
  getDatabase,
  type Database,
  ref,
  push,
  onValue,
  get,
  set,
  update,
  type DatabaseReference,
  type DataSnapshot,
  type Unsubscribe
} from "firebase/database";
import { app } from "./config";
import type { Group, User } from "../types/database";

export const rtdb: Database = getDatabase(app);

export const add = async (path: string, data: any): Promise<DatabaseReference> => {
  const dbRef = ref(rtdb, path);
  const newRef = push(dbRef);
  await set(newRef, data);
  return newRef;
};

export const updateData = async (path: string, data: any): Promise<void> => {
  const dbRef = ref(rtdb, path);
  await update(dbRef, data);
};

export const getDoc = async (path: string): Promise<any> => {
  const dbRef = ref(rtdb, path);
  const snapshot = await get(dbRef);
  return snapshot.val();
};

export const setDoc = async (path: string, data: any): Promise<void> => {
  const dbRef = ref(rtdb, path);
  await set(dbRef, data);
};

export const removeDoc = async (path: string): Promise<void> => {
  const dbRef = ref(rtdb, path);
  await set(dbRef, null);
};

export const listen = (path: string, callback: (snapshot: DataSnapshot) => void): Unsubscribe => {
  const dbRef = ref(rtdb, path);
  return onValue(dbRef, callback);
};

export const fetchGroupFromFirebase = async (groupId: string): Promise<Group | null> => {
  try {
    const groupRef = ref(rtdb, `groups/${groupId}`);
    const snapshot = await get(groupRef);
    if (!snapshot.exists()) {
      return null;
    }
    return {
      id: snapshot.key as string,
      ...snapshot.val(),
    } as Group;
  } catch (error) {
    console.error("Error fetching group from Firebase", error);
    return null;
  }
};

export const fetchProfileFromFirebase = async (userId: string): Promise<User | null> => {
  try {
    const profileRef = ref(rtdb, `users/${userId}`);
    const snapshot = await get(profileRef);
    if (!snapshot.exists()) {
      return null;
    }
    return {
      uid: snapshot.key as string,
      ...snapshot.val(),
    } as User;
  } catch (error) {
    console.error("Error fetching profile from Firebase", error);
    return null;
  }
}