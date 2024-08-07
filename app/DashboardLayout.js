"use client";

import { Loader } from "./components/Loader";
export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col">
      <Loader />
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}