"use client";
import React, {useEffect } from "react";
import ReactGA from 'react-ga4';
const TRACKING_ID = "G-PQRYNYL07B";

export default function GAProvider({ children }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      ReactGA.initialize(TRACKING_ID);
      ReactGA.send({ hitType: "pageview", page: window.location.pathname });
    }
  }, []);

  return children;
}