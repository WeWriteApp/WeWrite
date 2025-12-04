"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useAuth } from '../providers/AuthProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Trophy,
  FileText,
  Link2,
  Heart,
  Eye,
  Loader2,
  Medal,
  Calendar,
  Check
} from "lucide-react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import NavPageLayout from "../components/layout/NavPageLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

// Types
type LeaderboardCategory = 'pages-created' | 'pages-linked' | 'new-sponsors' | 'page-visits';
type TimePeriod = 'week' | 'month' | '6months';

interface LeaderboardUser {
  userId: string;
  username: string;
  photoURL?: string;
  count: number;
  rank: number;
}

interface CategoryConfig {
  id: LeaderboardCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  countLabel: string;
}

const categories: CategoryConfig[] = [
  {
    id: 'pages-created',
    label: 'Pages Created',
    icon: FileText,
    description: 'Most pages written',
    countLabel: 'pages'
  },
  {
    id: 'pages-linked',
    label: 'Links Received',
    icon: Link2,
    description: 'Most links to their pages',
    countLabel: 'links'
  },
  {
    id: 'new-sponsors',
    label: 'New Sponsors',
    icon: Heart,
    description: 'Most sponsors gained',
    countLabel: 'sponsors'
  },
  {
    id: 'page-visits',
    label: 'Page Views',
    icon: Eye,
    description: 'Most views received',
    countLabel: 'views'
  }
];

// Medal colors for top 3
const getMedalColor = (rank: number): string | null => {
  switch (rank) {
    case 1: return 'text-yellow-500';
    case 2: return 'text-gray-400';
    case 3: return 'text-amber-600';
    default: return null;
  }
};

// Period display labels
const periodLabels: Record<TimePeriod, string> = {
  'week': 'Past 7 Days',
  'month': 'Past 30 Days',
  '6months': 'Past 6 Months'
};

// Loading fallback component
function LeaderboardLoading() {
  return (
    <NavPageLayout maxWidth="2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-500" />
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
      </div>
    </NavPageLayout>
  );
}

// Main leaderboard content component
function LeaderboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const chipsContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize from URL params or defaults
  const getInitialCategory = (): LeaderboardCategory => {
    const param = searchParams.get('category');
    const validCategories: LeaderboardCategory[] = ['pages-created', 'pages-linked', 'new-sponsors', 'page-visits'];
    if (param && validCategories.includes(param as LeaderboardCategory)) {
      return param as LeaderboardCategory;
    }
    return 'pages-created';
  };
  
  const getInitialPeriod = (): TimePeriod => {
    const param = searchParams.get('period');
    const validPeriods: TimePeriod[] = ['week', 'month', '6months'];
    if (param && validPeriods.includes(param as TimePeriod)) {
      return param as TimePeriod;
    }
    return 'month';
  };
  
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>(getInitialCategory);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(getInitialPeriod);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update URL when category or period changes
  const updateUrl = useCallback((category: LeaderboardCategory, period: TimePeriod) => {
    const params = new URLSearchParams();
    params.set('category', category);
    params.set('period', period);
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  }, [router]);

  // Handler for category change
  const handleCategoryChange = useCallback((category: LeaderboardCategory) => {
    setSelectedCategory(category);
    updateUrl(category, selectedPeriod);
  }, [selectedPeriod, updateUrl]);

  // Handler for period change
  const handlePeriodChange = useCallback((period: TimePeriod) => {
    setSelectedPeriod(period);
    updateUrl(selectedCategory, period);
  }, [selectedCategory, updateUrl]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/leaderboard?category=${selectedCategory}&period=${selectedPeriod}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      const data = await response.json();
      setLeaderboard(data.data?.leaderboard || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Unable to load leaderboard. Please try again.');
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedPeriod]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const selectedCategoryConfig = categories.find(c => c.id === selectedCategory)!;

  const periodLabel = periodLabels[selectedPeriod];

  return (
    <NavPageLayout maxWidth="2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-500" />
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        </div>
        
        {/* Period Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{periodLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => handlePeriodChange('week')}
              className="gap-2"
            >
              {selectedPeriod === 'week' && <Check className="h-4 w-4" />}
              <span className={selectedPeriod !== 'week' ? 'ml-6' : ''}>This Week</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handlePeriodChange('month')}
              className="gap-2"
            >
              {selectedPeriod === 'month' && <Check className="h-4 w-4" />}
              <span className={selectedPeriod !== 'month' ? 'ml-6' : ''}>This Month</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handlePeriodChange('6months')}
              className="gap-2"
            >
              {selectedPeriod === '6months' && <Check className="h-4 w-4" />}
              <span className={selectedPeriod !== '6months' ? 'ml-6' : ''}>Past 6 Months</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category Chips - Horizontally Scrollable */}
      <div 
        ref={chipsContainerRef}
        className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {category.label}
            </button>
          );
        })}
      </div>

      {/* Description */}
      <p className="text-muted-foreground text-sm mt-4 mb-6">
        {selectedCategoryConfig.description} {periodLabel.toLowerCase()}
      </p>

      {/* Leaderboard */}
      <div className="wewrite-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLeaderboard}>
              Try Again
            </Button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Trophy className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No data available for this {selectedPeriod} yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Column Header */}
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wide bg-muted/30">
              <div className="w-6 flex-shrink-0 text-center">#</div>
              <div className="flex-1">User</div>
              <div className="flex-shrink-0 text-right capitalize">{selectedCategoryConfig.countLabel}</div>
            </div>
            
            {leaderboard.map((entry) => {
              const medalColor = getMedalColor(entry.rank);
              const isCurrentUser = user?.uid === entry.userId;
              
              return (
                <Link
                  key={entry.userId}
                  href={`/user/${entry.userId}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors",
                    isCurrentUser && "bg-primary/5"
                  )}
                >
                  {/* Rank */}
                  <div className="w-6 flex-shrink-0 flex items-center justify-center">
                    {medalColor ? (
                      <Medal className={cn("h-5 w-5", medalColor)} />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        {entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Username */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium truncate text-sm",
                      isCurrentUser && "text-primary"
                    )}>
                      {entry.username}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                  </div>

                  {/* Count */}
                  <div className="flex-shrink-0 text-right">
                    <p className="font-bold text-sm">
                      {entry.count.toLocaleString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        Leaderboards update in real-time
      </p>
    </NavPageLayout>
  );
}

// Default export with Suspense wrapper for useSearchParams
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardLoading />}>
      <LeaderboardContent />
    </Suspense>
  );
}
