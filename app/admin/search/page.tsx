"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "../../providers/AuthProvider";
import { adminFetch, getAdminDataSource } from "../../utils/adminFetch";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// Hook to measure container dimensions
function useContainerSize(ref: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const updateSize = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return size;
}

interface SearchProvider {
  name: string;
  status: "active" | "fallback" | "unavailable";
  configured: boolean;
  details?: string;
  collections?: {
    pages: { name: string; numDocuments: number } | null;
    users: { name: string; numDocuments: number } | null;
  };
}

interface SearchAnalytics {
  success: boolean;
  activeProvider: string;
  providers: SearchProvider[];
  collectionNames: { pages: string; users: string };
  performance: {
    totalSearches: number;
    averageSearchTime: number;
    cacheHitRate: number;
    fastSearches: number;
    normalSearches: number;
    slowSearches: number;
    verySlowSearches: number;
    apiErrors: number;
    timeouts: number;
  };
  recentSearches: Array<{
    searchTerm: string;
    duration: number;
    resultCount: number;
    cacheHit: boolean;
    source: string;
    timestamp: string;
  }>;
  slowSearches: Array<{
    searchTerm: string;
    duration: number;
    resultCount: number;
    timestamp: string;
  }>;
  searchPatterns: Record<string, { count: number; avgTime: number }>;
  performanceAlerts: Array<{
    type: string;
    severity: "warning" | "critical";
    message: string;
    timestamp: string;
  }>;
  recommendations: Array<{
    type: string;
    priority: "high" | "critical";
    message: string;
  }>;
  timestamp: string;
}

// Custom tooltip component
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="font-medium text-foreground">
          {entry.name}: {entry.value}
          {entry.dataKey === "duration" ? "ms" : ""}
        </p>
      ))}
    </div>
  );
};

// Status badge component
function StatusBadge({ status }: { status: "active" | "fallback" | "unavailable" }) {
  const styles = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    fallback: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    unavailable: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Provider card component
function ProviderCard({ provider }: { provider: SearchProvider }) {
  const iconName = provider.name === "Typesense" ? "Search" : "Database";

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon name={iconName} size={20} className="text-muted-foreground" />
          <h3 className="font-semibold">{provider.name}</h3>
        </div>
        <StatusBadge status={provider.status} />
      </div>
      <p className="text-sm text-muted-foreground">{provider.details}</p>
      {provider.collections && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {provider.collections.pages && (
              <div>
                <span className="text-muted-foreground">Pages:</span>{" "}
                <span className="font-medium">
                  {provider.collections.pages.numDocuments.toLocaleString()}
                </span>
              </div>
            )}
            {provider.collections.users && (
              <div>
                <span className="text-muted-foreground">Users:</span>{" "}
                <span className="font-medium">
                  {provider.collections.users.numDocuments.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Metric card component
function MetricCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  variant?: "default" | "success" | "warning" | "error";
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon name={icon} size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

// Recent searches chart
function RecentSearchesChart({
  searches,
}: {
  searches: SearchAnalytics["recentSearches"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);

  const chartData = [...searches]
    .reverse()
    .map((s, i) => ({
      index: i + 1,
      duration: s.duration,
      results: s.resultCount,
      label: s.searchTerm.substring(0, 15) || "empty",
    }));

  const height = 200;
  const canRender = width > 50;

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      {canRender && chartData.length > 0 && (
        <LineChart width={width} height={height} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="index"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#999" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#999" }}
            width={40}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="duration"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Duration"
          />
        </LineChart>
      )}
      {chartData.length === 0 && (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          No recent searches
        </div>
      )}
    </div>
  );
}

// Search patterns chart
function SearchPatternsChart({
  patterns,
}: {
  patterns: SearchAnalytics["searchPatterns"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);

  const chartData = Object.entries(patterns).map(([pattern, stats]) => ({
    pattern,
    count: stats.count,
    avgTime: stats.avgTime,
  }));

  const height = 200;
  const canRender = width > 50;

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      {canRender && chartData.length > 0 && (
        <BarChart width={width} height={height} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="pattern"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#999" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#999" }}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Count" />
        </BarChart>
      )}
      {chartData.length === 0 && (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          No search patterns recorded
        </div>
      )}
    </div>
  );
}

export default function SearchAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"dev" | "production">("dev");

  // Auth check
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/auth/login?redirect=/admin/search");
      return;
    }

    if (!user.isAdmin) {
      router.push("/");
      return;
    }
  }, [user, authLoading, router]);

  // Track data source changes
  useEffect(() => {
    const checkDataSource = () => {
      setDataSource(getAdminDataSource());
    };
    checkDataSource();
    // Check periodically in case it changes from another tab/component
    const interval = setInterval(checkDataSource, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch analytics
  useEffect(() => {
    if (!user?.isAdmin) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await adminFetch("/api/admin/search-analytics");
        if (!response.ok) throw new Error("Failed to fetch analytics");
        const data = await response.json();
        setAnalytics(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [user?.isAdmin, dataSource]);

  if (authLoading || !user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Search Analytics</h1>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  dataSource === "production"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}
              >
                {dataSource === "production" ? "Production" : "Development"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor search performance and provider status
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Icon name="RefreshCw" size={16} />
            Refresh
          </button>
        </div>

        {loading && !analytics ? (
          <div className="flex items-center justify-center py-20">
            <Icon name="Loader" size={32} className="text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="border border-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Search Providers Section */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon name="Server" size={20} />
                Search Providers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.providers.map((provider) => (
                  <ProviderCard key={provider.name} provider={provider} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Current environment collections:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {analytics.collectionNames.pages}
                </code>
                ,{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {analytics.collectionNames.users}
                </code>
              </p>
            </section>

            {/* Performance Metrics */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon name="Activity" size={20} />
                Performance Metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Searches"
                  value={analytics.performance.totalSearches.toLocaleString()}
                  icon="Search"
                />
                <MetricCard
                  title="Avg Response Time"
                  value={`${analytics.performance.averageSearchTime}ms`}
                  icon="Clock"
                  variant={
                    analytics.performance.averageSearchTime > 500
                      ? "warning"
                      : analytics.performance.averageSearchTime > 1000
                      ? "error"
                      : "success"
                  }
                />
                <MetricCard
                  title="Cache Hit Rate"
                  value={`${analytics.performance.cacheHitRate}%`}
                  icon="Zap"
                  variant={
                    analytics.performance.cacheHitRate >= 50
                      ? "success"
                      : analytics.performance.cacheHitRate >= 30
                      ? "warning"
                      : "error"
                  }
                />
                <MetricCard
                  title="Errors"
                  value={analytics.performance.apiErrors}
                  subtitle={`${analytics.performance.timeouts} timeouts`}
                  icon="AlertTriangle"
                  variant={analytics.performance.apiErrors > 0 ? "error" : "success"}
                />
              </div>

              {/* Speed breakdown */}
              <div className="grid grid-cols-4 gap-4 mt-4">
                <MetricCard
                  title="Fast (<200ms)"
                  value={analytics.performance.fastSearches}
                  icon="Zap"
                  variant="success"
                />
                <MetricCard
                  title="Normal (200-500ms)"
                  value={analytics.performance.normalSearches}
                  icon="Check"
                />
                <MetricCard
                  title="Slow (500-1000ms)"
                  value={analytics.performance.slowSearches}
                  icon="Clock"
                  variant="warning"
                />
                <MetricCard
                  title="Very Slow (>1s)"
                  value={analytics.performance.verySlowSearches}
                  icon="AlertCircle"
                  variant="error"
                />
              </div>
            </section>

            {/* Charts */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon name="BarChart3" size={20} />
                Search Activity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border rounded-lg p-4 bg-card">
                  <h3 className="font-medium mb-3">Recent Search Response Times</h3>
                  <RecentSearchesChart searches={analytics.recentSearches} />
                </div>
                <div className="border border-border rounded-lg p-4 bg-card">
                  <h3 className="font-medium mb-3">Search Patterns by Length</h3>
                  <SearchPatternsChart patterns={analytics.searchPatterns} />
                </div>
              </div>
            </section>

            {/* Recent Searches Table */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon name="List" size={20} />
                Recent Searches
              </h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Search Term</th>
                      <th className="text-left p-3 font-medium">Duration</th>
                      <th className="text-left p-3 font-medium">Results</th>
                      <th className="text-left p-3 font-medium">Cache</th>
                      <th className="text-left p-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentSearches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          No recent searches
                        </td>
                      </tr>
                    ) : (
                      analytics.recentSearches.map((search, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-3 font-mono text-xs">
                            {search.searchTerm || <span className="text-muted-foreground italic">empty</span>}
                          </td>
                          <td className="p-3">
                            <span
                              className={
                                search.duration > 1000
                                  ? "text-red-600 dark:text-red-400"
                                  : search.duration > 500
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-green-600 dark:text-green-400"
                              }
                            >
                              {search.duration}ms
                            </span>
                          </td>
                          <td className="p-3">{search.resultCount}</td>
                          <td className="p-3">
                            {search.cacheHit ? (
                              <span className="text-green-600 dark:text-green-400">Hit</span>
                            ) : (
                              <span className="text-muted-foreground">Miss</span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {new Date(search.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Alerts & Recommendations */}
            {(analytics.performanceAlerts.length > 0 ||
              analytics.recommendations.length > 0) && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Icon name="Bell" size={20} />
                  Alerts & Recommendations
                </h2>
                <div className="space-y-3">
                  {analytics.performanceAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`border rounded-lg p-3 ${
                        alert.severity === "critical"
                          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                          : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          name={alert.severity === "critical" ? "AlertCircle" : "AlertTriangle"}
                          size={16}
                          className={
                            alert.severity === "critical"
                              ? "text-red-600 dark:text-red-400"
                              : "text-yellow-600 dark:text-yellow-400"
                          }
                        />
                        <span className="font-medium">{alert.message}</span>
                      </div>
                    </div>
                  ))}
                  {analytics.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="Lightbulb" size={16} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-medium">{rec.message}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            rec.priority === "critical"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                          }`}
                        >
                          {rec.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Last updated */}
            <p className="text-xs text-muted-foreground text-center pt-4">
              Last updated: {new Date(analytics.timestamp).toLocaleString()}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
