"use client";
import Header from "./components/Header";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col">
      <Header />
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}