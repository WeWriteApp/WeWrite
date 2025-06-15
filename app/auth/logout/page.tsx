"use client";

import { useEffect } from "react";
import { logoutUser } from "../../firebase/auth";
import { useRouter } from 'next/navigation';

const Logout = (): null => {
  const router = useRouter();

  useEffect(() => {
    logoutUser().then(() => {
      router.push('/');
    });
  }, [router]);

  return null;
};

export default Logout;