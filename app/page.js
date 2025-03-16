"use client";

import Header from "./components/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="p-4">
        <h1 className="text-2xl font-bold text-foreground">Welcome to WeWrite</h1>
        <p className="mt-2 text-foreground">The social wiki where every page is a fundraiser</p>
      </main>
    </>
  );
}
