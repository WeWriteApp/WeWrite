"use client";

import { useAuth } from "../../providers/AuthProvider";
import { AlertTriangle, Heart } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

/**
 * Construction banner component that appears at the bottom of logged-in pages
 * to inform users that WeWrite is still under development and encourage donations.
 */
export default function ConstructionBanner() {
  const { user } = useAuth();

  // Only show for logged-in users
  if (!user) {
    return null;
  }

  return (
    <div className="w-full bg-red-600 text-white border-t border-red-700 shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Warning info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-semibold">WeWrite is still under development</span>
                <span className="text-sm text-red-100">
                  Please consider donating to help us pay for engineering costs
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/settings/subscription">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200"
              >
                <Heart className="h-4 w-4 mr-2" />
                Support Us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
