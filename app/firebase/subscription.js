import { 
  getFirestore,
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc as fsUpdateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "firebase/firestore";

import app from "./config";
import { db } from "./database";

// Create a user subscription
export const createSubscription = async (userId, subscriptionData) => {
  try {
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    await setDoc(subscriptionRef, {
      ...subscriptionData,
      status: "inactive", // inactive until payment is processed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error creating subscription:", error);
    return false;
  }
};

// Update a user's subscription
export const updateSubscription = async (userId, subscriptionData) => {
  try {
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    await setDoc(subscriptionRef, {
      ...subscriptionData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating subscription:", error);
    return false;
  }
};

// Get a user's current subscription
export const getUserSubscription = async (userId) => {
  try {
    const subscriptionRef = doc(db, "users", userId, "subscription", "current");
    const subscriptionSnap = await getDoc(subscriptionRef);
    
    if (subscriptionSnap.exists()) {
      return { id: subscriptionSnap.id, ...subscriptionSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user subscription:", error);
    return null;
  }
};

// Create a pledge from a user to a page
export const createPledge = async (userId, pageId, pledgeAmount) => {
  try {
    // Create the pledge document
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await setDoc(pledgeRef, {
      pageId,
      amount: pledgeAmount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: fsUpdateDoc.increment(pledgeAmount),
      pledgeCount: fsUpdateDoc.increment(1),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: fsUpdateDoc.increment(pledgeAmount),
    });

    return true;
  } catch (error) {
    console.error("Error creating pledge:", error);
    return false;
  }
};

// Update a pledge amount
export const updatePledge = async (userId, pageId, newAmount, oldAmount) => {
  try {
    // Calculate the difference
    const amountDifference = newAmount - oldAmount;
    
    // Update the pledge
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await fsUpdateDoc(pledgeRef, {
      amount: newAmount,
      updatedAt: serverTimestamp(),
    });

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: fsUpdateDoc.increment(amountDifference),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: fsUpdateDoc.increment(amountDifference),
    });

    return true;
  } catch (error) {
    console.error("Error updating pledge:", error);
    return false;
  }
};

// Delete a pledge
export const deletePledge = async (userId, pageId, pledgeAmount) => {
  try {
    // Delete the pledge
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    await deleteDoc(pledgeRef);

    // Update the page's total pledged amount
    const pageRef = doc(db, "pages", pageId);
    await fsUpdateDoc(pageRef, {
      totalPledged: fsUpdateDoc.increment(-pledgeAmount),
      pledgeCount: fsUpdateDoc.increment(-1),
    });

    // Update user's total pledged amount
    const userSubscriptionRef = doc(db, "users", userId, "subscription", "current");
    await fsUpdateDoc(userSubscriptionRef, {
      pledgedAmount: fsUpdateDoc.increment(-pledgeAmount),
    });

    return true;
  } catch (error) {
    console.error("Error deleting pledge:", error);
    return false;
  }
};

// Get all pledges for a user
export const getUserPledges = async (userId) => {
  try {
    const pledgesRef = collection(db, "users", userId, "pledges");
    const pledgesSnap = await getDocs(pledgesRef);
    
    return pledgesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting user pledges:", error);
    return [];
  }
};

// Get a specific pledge
export const getPledge = async (userId, pageId) => {
  try {
    const pledgeRef = doc(db, "users", userId, "pledges", pageId);
    const pledgeSnap = await getDoc(pledgeRef);
    
    if (pledgeSnap.exists()) {
      return { id: pledgeSnap.id, ...pledgeSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting pledge:", error);
    return null;
  }
};

// Listen to changes in user's subscription
export const listenToUserSubscription = (userId, callback) => {
  const subscriptionRef = doc(db, "users", userId, "subscription", "current");
  
  return onSnapshot(subscriptionRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    } else {
      callback(null);
    }
  });
};

// Listen to changes in user's pledges
export const listenToUserPledges = (userId, callback) => {
  const pledgesRef = collection(db, "users", userId, "pledges");
  
  return onSnapshot(pledgesRef, (snapshot) => {
    const pledges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(pledges);
  });
}; 