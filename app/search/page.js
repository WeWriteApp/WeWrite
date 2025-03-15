"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SearchInput from "../components/SearchInput";
import DashboardLayout from "../DashboardLayout";

function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const handleSearch = (value) => {
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <SearchInput
      value={query}
      onChange={handleSearch}
      placeholder="Search pages..."
      className="w-full"
    />
  );
}

export default function SearchPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <div className="w-full">
          <Suspense fallback={
            <SearchInput
              value=""
              onChange={() => {}}
              placeholder="Loading..."
              className="w-full opacity-50"
              disabled
            />
          }>
            <SearchForm />
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
} 