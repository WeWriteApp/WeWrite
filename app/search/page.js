"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SearchInput from "../components/SearchInput";
import DashboardLayout from "../DashboardLayout";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const handleSearch = (value) => {
    setQuery(value);
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <div className="w-full">
          <SearchInput
            value={query}
            onChange={handleSearch}
            placeholder="Search pages..."
            className="w-full"
          />
        </div>
      </div>
    </DashboardLayout>
  );
} 