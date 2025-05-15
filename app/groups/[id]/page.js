"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";

export default function GroupRedirectPage({ params }) {
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    // Redirect to the correct group page
    if (id) {
      router.push(`/group/${id}`);
    }
  }, [router, id]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
