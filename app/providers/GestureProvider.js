"use client";
import { useEffect } from 'react';

const GestureProvider = ({ children }) => {
  useEffect(() => {
    // Function to handle gesturestart and gesturechange
    const handleGestureStartChange = (e) => {
      e.preventDefault();
      document.body.style.zoom = 0.99; // Adjust zoom level
    };

    // Function to handle gestureend
    const handleGestureEnd = (e) => {
      e.preventDefault();
      document.body.style.zoom = 1; // Reset zoom level
    };

    // Add event listeners when the component mounts
    document.addEventListener('gesturestart', handleGestureStartChange);
    document.addEventListener('gesturechange', handleGestureStartChange);
    document.addEventListener('gestureend', handleGestureEnd);

    // Clean up event listeners when the component unmounts
    return () => {
      document.removeEventListener('gesturestart', handleGestureStartChange);
      document.removeEventListener('gesturechange', handleGestureStartChange);
      document.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []); // Empty dependency array to run only once on mount

  return <>{children}</>;
};

export default GestureProvider;
