"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { ChevronLeft, Clock, Filter, Check } from "lucide-react";
import { useCurrentAccount } from "../providers/CurrentAccountProvider";
import { useActivityFilter } from "../contexts/ActivityFilterContext";
import RecentPagesActivity from "../components/features/RecentPagesActivity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "../components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger} from "../components/ui/tooltip";

/**
 * Client component for the activity page that uses the same hook as the home page
 * This ensures consistent behavior between the home page and activity page
 */
export default function ActivityPageClient({
  initialActivities = [],
  initialError = null
}: {
  initialActivities: any[],
  initialError: string | null
}) {
  const router = useRouter();
  const { currentAccount } = useCurrentAccount();
  const { viewMode, setViewMode } = useActivityFilter();

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToHome}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Button>
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Recent Edits</h1>
        </div>
      </div>

      {/* Activity Grid */}
      <RecentPagesActivity limit={50} isCarousel={false} />
    </div>
  );
}