"use client";
import DashboardLayout from "../DashboardLayout";
import TypeaheadSearch from "../components/TypeaheadSearch";

export default function SearchPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Search</h1>
        <div className="mb-8">
          <TypeaheadSearch />
        </div>
      </div>
    </DashboardLayout>
  );
} 