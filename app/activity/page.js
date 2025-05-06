"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RecentActivity from "../components/RecentActivity";
import { Button } from "../components/ui/button";
import { ChevronLeft, Clock } from "lucide-react";

export default function ActivityPage() {
  const router = useRouter();
  const [limit, setLimit] = useState(30);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/')}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-bold flex items-center absolute left-1/2 transform -translate-x-1/2">
          <Clock className="mr-2 h-5 w-5" />
          Recent Activity
        </h1>

        {/* Empty div to balance layout */}
        <div className="w-[73px]" />
      </div>

      <RecentActivity limit={limit} showViewAll={false} isActivityPage={true} />


    </div>
  );
}
