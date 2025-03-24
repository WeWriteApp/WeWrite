"use client";
import { useEffect } from "react";
import {logoutUser} from "../../firebase/auth";
import { useRouter } from 'next/navigation'

const Logout = () => {
  const router = useRouter()
  useEffect(() => {
    logoutUser().then(() => {
      router.push('/')
    });    
  }, []);

  return null;
}

export default Logout;