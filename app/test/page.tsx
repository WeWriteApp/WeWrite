"use client";

import { PageHeader } from "../components/PageHeader";

export default function TestPage() {
  return (
    <div className="container mx-auto p-4">
      <PageHeader title="Test Page" />
      <div className="mt-8">
        <p>This is a test page to demonstrate the PageHeader component.</p>
      </div>
    </div>
  );
} 