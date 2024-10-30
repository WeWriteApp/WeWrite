// src/hooks/useSearch.ts
import { useState } from "react";

export const useSearch = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (keyword: string) => {
    setLoading(true);
    setError(null);

    console.log("keyword", keyword)
    try {
      const response = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);

      console.log("response", response)
      if (!response.ok) {
        throw new Error("Failed to fetch search results");
      }
      else {

      }


      const data = await response.json();

      const uniqueItems = data.filter((item: any, index: any, self: any) =>
        index === self.findIndex((t: any) => t.document_id === item.document_id)
      );
      setResults(uniqueItems);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () =>{
    setResults([])
  }

  return { results, loading, error, search, clear };
};
