import { NextRequest, NextResponse } from "next/server";
import { searchPerformanceTracker } from "../../../utils/searchPerformanceTracker";
import {
  isTypesenseConfigured,
  isTypesenseAdminConfigured,
  getCollectionStats,
  getTypesenseCollectionNamesForEnv,
} from "../../../lib/typesense";
import { shouldForceProductionFromContext, withAdminContext } from "../../../utils/adminRequestContext";

export const dynamic = "force-dynamic";

interface SearchProviderStatus {
  name: string;
  status: "active" | "fallback" | "unavailable";
  configured: boolean;
  details?: string;
  collections?: {
    pages: { name: string; numDocuments: number } | null;
    users: { name: string; numDocuments: number } | null;
  };
}

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      // Get search performance stats from the tracker
      const performanceStats = searchPerformanceTracker.getStats();

      // Check Typesense status
      const typesenseConfigured = isTypesenseConfigured();
      const typesenseAdminConfigured = isTypesenseAdminConfigured();

      // Get provider statuses
      const providers: SearchProviderStatus[] = [];

      // Typesense provider
      let typesenseCollections = null;
      if (typesenseAdminConfigured) {
        try {
          typesenseCollections = await getCollectionStats();
        } catch (e) {
          // Collection stats failed, but Typesense might still be working
        }
      }

      providers.push({
        name: "Typesense",
        status: typesenseConfigured ? "active" : "unavailable",
        configured: typesenseConfigured,
        details: typesenseConfigured
          ? `Primary search engine${
              typesenseCollections?.pages
                ? ` - ${typesenseCollections.pages.numDocuments.toLocaleString()} pages indexed`
                : ""
            }`
          : "Not configured - missing NEXT_PUBLIC_TYPESENSE_HOST or NEXT_PUBLIC_TYPESENSE_SEARCH_KEY",
        collections: typesenseCollections || undefined,
      });

      // Firestore fallback provider (always available)
      providers.push({
        name: "Firestore",
        status: typesenseConfigured ? "fallback" : "active",
        configured: true,
        details: typesenseConfigured
          ? "Fallback search engine - used when Typesense is unavailable"
          : "Active search engine (Typesense not configured)",
      });

      // Determine active provider
      const activeProvider = providers.find((p) => p.status === "active")?.name || "Unknown";

      // Get collection names for current environment (respects admin context)
      const forceProduction = shouldForceProductionFromContext();
      const collectionNames = getTypesenseCollectionNamesForEnv(forceProduction);

      return NextResponse.json({
        success: true,
        activeProvider,
        providers,
        collectionNames,
        performance: {
          totalSearches: performanceStats.totalSearches,
          averageSearchTime: performanceStats.averageSearchTime,
          cacheHitRate: performanceStats.cacheHitRate,
          fastSearches: performanceStats.fastSearches,
          normalSearches: performanceStats.normalSearches,
          slowSearches: performanceStats.slowSearches,
          verySlowSearches: performanceStats.verySlowSearches,
          apiErrors: performanceStats.apiErrors,
          timeouts: performanceStats.timeouts,
        },
        recentSearches: performanceStats.recentSearches,
        slowSearches: performanceStats.slowSearches,
        searchPatterns: performanceStats.searchPatterns,
        performanceAlerts: performanceStats.performanceAlerts,
        recommendations: performanceStats.recommendations,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Search Analytics] Error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch search analytics",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
