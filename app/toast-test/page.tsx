"use client";

import { ToastTester } from "../components/ToastTester";

export default function ToastTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Toast Test Page</h1>
      <p className="mb-4">
        This page is used to test the toast notification system in both light and dark modes.
      </p>
      <ToastTester />
    </div>
  );
}
