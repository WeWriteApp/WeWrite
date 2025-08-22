"use client";

import { useEffect } from "react";
import { useAuth } from "../../providers/AuthProvider";

const Logout = (): null => {
  const { signOut } = useAuth();

  useEffect(() => {
    // Use the consolidated logout from AuthProvider
    signOut();
  }, [signOut]);

  return null;
};

export default Logout;