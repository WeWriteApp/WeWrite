"use client";
// an auth provider that watches onAuthState change for firebase with a context provider
import { useEffect, useState, createContext, useContext } from "react";
import { auth } from "../firebase/auth";
import  app  from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, get, set, getDatabase,update } from "firebase/database";
import { useRouter } from "next/navigation";

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

  const getSubscription = async (customerId) => {
    try {
      const response = await fetch(`/api/payments/subscription?uid=${customerId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching subscription");
      return null;
    }
  }

  const getUserFromRTDB =  (user) => {
    const db = getDatabase(app);

    let uid = user.uid;
    const dbRef = ref(db, `users/${uid}`);

    onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      setUser({
        uid: user.uid,
        email: user.email,
        ...data
      });

      console.log(uid);

      // get the subscription data
      getSubscription(data.stripeCustomerId).then((subscriptionData) => {
        setUser((prevUser) => ({
          ...prevUser,
          subscription: subscriptionData
        }));
        setLoading(false);
      }).catch((error) => {
        console.error("Error fetching subscription data:", error);
        setLoading(false);
      });
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
};
