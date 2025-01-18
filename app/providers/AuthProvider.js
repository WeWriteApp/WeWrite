"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext, useContext } from "react";
import { auth } from "../firebase/auth";
import  app  from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get, set, getDatabase,update } from "firebase/database";
import { useRouter } from "next/navigation";

// Starting to decide on budget
let budgetAllocation = {
  budget: 1000, // $10 in cents
  subscriptions: {
    "zE0nideSRtREdbbDOext": {
      amount: 500,
      sellerId: "fWNeCuussPgYgkN2LGohFRCPXiy1",
      pageId: "zE0nideSRtREdbbDOext",
      date: new Date(new Date().setDate(new Date().getDate() - 3)),
      status: "active",
    }
  }
};

const calculateUsedBudget = (subscriptions) => {
  return Object.values(subscriptions)
    .filter((sub) => sub.status === "active")
    .reduce((sum, sub) => sum + sub.amount, 0);
};


export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        getUserFromRTDB(user);

      } else {    
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const getUserFromRTDB =  (user) => {
    const db = getDatabase(app);

    let uid = user.uid;
    const dbRef = ref(db, `users/${uid}`);
    // get the user from the database
    onValue(dbRef, (snapshot) => {
      const data = snapshot.val();

      if (!data.username && user.displayName) {
        let updates = {};
        updates[`users/${uid}/username`] = user.displayName;
        update(ref(db), updates);
        data.displayName = user.displayName;
      } else if (data.username !== user.displayName) {
        let updates = {};
        updates[`users/${uid}/username`] = user.displayName;
        update(ref(db), updates);
        data.username = user.displayName;
      }

      const ledger = data.ledger || budgetAllocation;
      const used = calculateUsedBudget(ledger.subscriptions);

      setUser({
        uid: user.uid,
        email: user.email,
        ledger: {
          ...ledger,
          used, // Calculate used budget
        },
        ...data
      });

      setLoading(false);
    });
  }


  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
}