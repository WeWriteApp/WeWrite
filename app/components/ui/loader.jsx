import React from "react";

export function Loader({ className }) {
  return (
    <div className={`animate-spin rounded-full border-2 border-primary border-t-transparent ${className || "h-6 w-6"}`} />
  );
}
