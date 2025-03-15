"use client";
import Dashboard from "./components/Dashboard";

export async function generateMetadata() {
  return {
    title: "Your WeWrite",
    description: "Your WeWrite dashboard",
  };
}

export default function Home() {
  return (
    <Dashboard />
  );
}
