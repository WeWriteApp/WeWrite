"use client";

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react";
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '../providers/AuthProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from "next/link";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import NavPageLayout from "../components/layout/NavPageLayout";
import { LottieAnimation, TrophyAnimation, StarAnimation, FireAnimation } from "../components/ui/LottieAnimation";

// Types
type UserLeaderboardCategory = 'pages-created' | 'links-received' | 'sponsors-gained' | 'page-views';
type PageLeaderboardCategory = 'new-supporters' | 'most-replies' | 'most-views' | 'most-links';

interface LeaderboardUser {
  userId: string;
  username: string;
  profilePicture?: string;
  count: number;
  rank: number;
}

interface LeaderboardPage {
  pageId: string;
  title: string;
  userId: string;
  username: string;
  count: number;
  rank: number;
}

interface UserCategoryConfig {
  id: UserLeaderboardCategory;
  label: string;
  icon: string;
  description: string;
  countLabel: string;
}

interface PageCategoryConfig {
  id: PageLeaderboardCategory;
  label: string;
  icon: string;
  description: string;
  countLabel: string;
}

const userCategories: UserCategoryConfig[] = [
  {
    id: 'pages-created',
    label: 'Pages Created',
    icon: 'FileText',
    description: 'Most pages written',
    countLabel: 'pages'
  },
  {
    id: 'links-received',
    label: 'Links Received',
    icon: 'Link2',
    description: 'Most links to their pages',
    countLabel: 'links'
  },
  {
    id: 'sponsors-gained',
    label: 'New Sponsors',
    icon: 'Heart',
    description: 'Most sponsors gained',
    countLabel: 'sponsors'
  },
  {
    id: 'page-views',
    label: 'Page Views',
    icon: 'Eye',
    description: 'Most views received',
    countLabel: 'views'
  }
];

const pageCategories: PageCategoryConfig[] = [
  {
    id: 'new-supporters',
    label: 'New Sponsors',
    icon: 'Heart',
    description: 'Most users donating to this page',
    countLabel: 'sponsors'
  },
  {
    id: 'most-replies',
    label: 'Most Replies',
    icon: 'MessageSquare',
    description: 'Most reply pages',
    countLabel: 'replies'
  },
  {
    id: 'most-views',
    label: 'Most Views',
    icon: 'Eye',
    description: 'Most page views',
    countLabel: 'views'
  },
  {
    id: 'most-links',
    label: 'Most Links',
    icon: 'Link2',
    description: 'Most links received',
    countLabel: 'links'
  }
];

// Generate list of available months (past 24 months, oldest first, newest last)
function getAvailableMonths(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Build list from oldest to newest (23 months ago -> this month)
  for (let i = 23; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    // Label current month as "This month", otherwise use short format
    const label = value === currentMonth 
      ? 'This month' 
      : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months.push({ value, label });
  }
  
  return months;
}

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Format month for display
function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Medal colors for top 3
const getMedalColor = (rank: number): string | null => {
  switch (rank) {
    case 1: return 'text-yellow-500';
    case 2: return 'text-gray-400';
    case 3: return 'text-amber-600';
    default: return null;
  }
};

// Month Selector Component
function MonthSelector({ 
  selectedMonth, 
  onMonthChange,
  onClose
}: { 
  selectedMonth: string; 
  onMonthChange: (month: string) => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => getAvailableMonths(), []);
  
  // Scroll to selected month on mount (now at end/right side)
  useEffect(() => {
    if (scrollRef.current) {
      const selectedElement = scrollRef.current.querySelector(`[data-month="${selectedMonth}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedMonth]);
  
  return (
    <div className="relative">
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {months.map(month => (
          <button
            key={month.value}
            data-month={month.value}
            onClick={() => {
              onMonthChange(month.value);
              onClose();
            }}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors snap-center",
              month.value === selectedMonth
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            {month.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Detail View Component for a single leaderboard
function LeaderboardDetailView<T extends UserCategoryConfig | PageCategoryConfig>({
  category,
  data,
  loading,
  error,
  onRetry,
  onBack,
  selectedMonth,
  renderEntry,
  type
}: {
  category: T;
  data: any[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  selectedMonth: string;
  renderEntry: (entry: any, category: T, isFirst?: boolean) => React.ReactNode;
  type: 'user' | 'page';
}) {
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/leaderboard?view=${type}&category=${category.id}&month=${selectedMonth}`;
    if (navigator.share) {
      navigator.share({ 
        title: `${category.label} Leaderboard - ${formatMonth(selectedMonth)}`, 
        url: shareUrl 
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Navigation buttons above card */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2"
        >
          <Icon name="ArrowLeft" size={16} />
          Leaderboards
        </Button>
        <Button
          variant="ghost"
          onClick={handleShare}
          className="gap-2"
        >
          <Icon name="Share2" size={16} />
          Share
        </Button>
      </div>

      {/* Content Card with header inside */}
      <div className="wewrite-card rounded-xl overflow-hidden">
        {/* Card Header - mobile optimized */}
        <div className="px-4 py-4 border-b border-border">
          {/* Mobile: stack vertically, Desktop: horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            {/* Top row on mobile: Icon + Title + Date */}
            <div className="flex items-center gap-3 sm:contents">
              {/* Icon Container */}
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-sm">
                <Icon name={category.icon as any} className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              {/* Title + Description */}
              <div className="flex-1 min-w-0 sm:order-2">
                <h1 className="text-lg sm:text-xl font-bold">{category.label}</h1>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
              {/* Date Badge - inline on mobile, right-aligned on desktop */}
              <div className="flex-shrink-0 sm:order-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground whitespace-nowrap">
                  <Icon name="Calendar" size={12} className="sm:h-3.5 sm:w-3.5" />
                  {formatMonth(selectedMonth)}
                </span>
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="Loader" className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="Heart" size={48} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No data available yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.slice(0, 20).map((entry: any, index: number) => renderEntry(entry, category, index === 0))}
          </div>
        )}
      </div>
    </div>
  );
}

// Carousel Component for both user and page leaderboards
function LeaderboardCarousel<T extends UserCategoryConfig | PageCategoryConfig>({
  title,
  titleIcon,
  categories,
  selectedIndex,
  onSelectIndex,
  data,
  loading,
  error,
  onRetry,
  renderEntry,
  type,
  onOpenDetail,
  selectedMonth
}: {
  title: string;
  titleIcon: string;
  categories: T[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  data: Record<string, any[]>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  renderEntry: (entry: any, category: T, isFirst?: boolean) => React.ReactNode;
  type: 'user' | 'page';
  onOpenDetail: (type: 'user' | 'page', categoryId: string) => void;
  selectedMonth: string;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const navigateCategory = useCallback((direction: 'next' | 'prev') => {
    let newIndex;
    if (direction === 'next') {
      newIndex = (selectedIndex + 1) % categories.length;
    } else {
      newIndex = (selectedIndex - 1 + categories.length) % categories.length;
    }
    onSelectIndex(newIndex);
  }, [selectedIndex, categories.length, onSelectIndex]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      navigateCategory('next');
    } else if (isRightSwipe) {
      navigateCategory('prev');
    }
  };

  const handleShare = (e: React.MouseEvent, category: T) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/leaderboard?view=${type}&category=${category.id}&month=${selectedMonth}`;
    if (navigator.share) {
      navigator.share({ 
        title: `${category.label} Leaderboard - ${formatMonth(selectedMonth)}`, 
        url: shareUrl 
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  // Calculate centered transform - card width is 82% to show neighboring cards
  const cardWidthPercent = 82;
  const gapPercent = 3; // 3% gap
  
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-4">
        <Icon name={titleIcon as any} className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden px-4">
        <div 
          ref={carouselRef}
          className="relative touch-pan-y"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Navigation Arrows - Desktop only */}
          <button
            onClick={() => navigateCategory('prev')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-muted transition-colors"
            aria-label="Previous leaderboard"
          >
            <Icon name="ChevronLeft" size={20} />
          </button>
          <button
            onClick={() => navigateCategory('next')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-muted transition-colors"
            aria-label="Next leaderboard"
          >
            <Icon name="ChevronRight" size={20} />
          </button>

          {/* Cards Container - centered with visible neighbors */}
          <div 
            className="flex transition-transform duration-300 ease-out"
            style={{ 
              // Center the current card: offset by (100% - cardWidth) / 2 = 9%
              // Then move by (cardWidth + gap) for each index
              transform: `translateX(calc(9% - ${selectedIndex * (cardWidthPercent + gapPercent)}%))`,
            }}
          >
            {categories.map((category, index) => {
              const leaderboard = data[category.id] || [];
              const isActive = index === selectedIndex;
              
              return (
                <div
                  key={category.id}
                  className="flex-shrink-0"
                  style={{ 
                    width: `${cardWidthPercent}%`,
                    marginRight: `${gapPercent}%`,
                    opacity: isActive ? 1 : 0.5, 
                    transform: isActive ? 'scale(1)' : 'scale(0.95)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease' 
                  }}
                >
                  <div 
                    className="wewrite-card rounded-xl overflow-hidden h-full cursor-pointer"
                    onClick={() => onOpenDetail(type, category.id)}
                  >
                    {/* Card Header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-base">{category.label}</h3>
                          <p className="text-xs text-muted-foreground">{category.description}</p>
                        </div>
                        <button
                          onClick={(e) => handleShare(e, category)}
                          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
                          aria-label={`Share ${category.label} leaderboard`}
                        >
                          <Icon name="Share2" size={16} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Icon name="Loader" className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : error ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onRetry(); }}>
                          Try Again
                        </Button>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Icon name="Heart" size={48} className="text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          No data available yet
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {leaderboard.slice(0, 5).map((entry: any, index: number) => renderEntry(entry, category, index === 0))}
                        
                        {/* View more button */}
                        <div className="px-3 py-2 text-center">
                          <span className="text-xs text-primary font-medium">
                            View More
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2.5">
        {categories.map((category, index) => (
          <button
            key={category.id}
            onClick={() => onSelectIndex(index)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors duration-200",
              index === selectedIndex
                ? "bg-primary"
                : "bg-neutral-30 hover:bg-neutral-40"
            )}
            aria-label={`Go to ${category.label}`}
          />
        ))}
      </div>
    </div>
  );
}

// Loading fallback component
function LeaderboardLoading() {
  return (
    <NavPageLayout maxWidth="2xl">
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center gap-3">
          <Icon name="Trophy" size={24} className="text-yellow-500" />
          <h1 className="text-xl font-bold tracking-tight">Leaderboards</h1>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="Loader" className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading leaderboards...</p>
      </div>
    </NavPageLayout>
  );
}

// Main leaderboard content component
function LeaderboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return searchParams.get('month') || getCurrentMonth();
  });
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [userCategoryIndex, setUserCategoryIndex] = useState(0);
  const [pageCategoryIndex, setPageCategoryIndex] = useState(0);
  
  // Detail view state
  const [detailView, setDetailView] = useState<{
    type: 'user' | 'page';
    categoryId: string;
  } | null>(null);
  
  const [userLeaderboardData, setUserLeaderboardData] = useState<Record<UserLeaderboardCategory, LeaderboardUser[]>>({
    'pages-created': [],
    'links-received': [],
    'sponsors-gained': [],
    'page-views': []
  });
  
  const [pageLeaderboardData, setPageLeaderboardData] = useState<Record<PageLeaderboardCategory, LeaderboardPage[]>>({
    'new-supporters': [],
    'most-replies': [],
    'most-views': [],
    'most-links': []
  });
  
  const [userLoading, setUserLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Parse URL params on mount for detail view
  useEffect(() => {
    const viewType = searchParams.get('view') as 'user' | 'page' | null;
    const categoryParam = searchParams.get('category');
    const monthParam = searchParams.get('month');
    
    if (monthParam) {
      setSelectedMonth(monthParam);
    }
    
    if (viewType && categoryParam) {
      setDetailView({ type: viewType, categoryId: categoryParam });
      
      // Also set the carousel index
      if (viewType === 'user') {
        const index = userCategories.findIndex(c => c.id === categoryParam);
        if (index >= 0) setUserCategoryIndex(index);
      } else {
        const index = pageCategories.findIndex(c => c.id === categoryParam);
        if (index >= 0) setPageCategoryIndex(index);
      }
    }
  }, [searchParams]);

  // Handle month change
  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', month);
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Handle opening detail view
  const handleOpenDetail = useCallback((type: 'user' | 'page', categoryId: string) => {
    setDetailView({ type, categoryId });
    // Update URL
    const params = new URLSearchParams();
    params.set('view', type);
    params.set('category', categoryId);
    params.set('month', selectedMonth);
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  }, [router, selectedMonth]);

  // Handle closing detail view
  const handleCloseDetail = useCallback(() => {
    setDetailView(null);
    // Update URL - remove view and category params
    const params = new URLSearchParams();
    params.set('month', selectedMonth);
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  }, [router, selectedMonth]);

  // Fetch user leaderboards
  const fetchUserLeaderboards = useCallback(async () => {
    setUserLoading(true);
    setUserError(null);
    
    try {
      const results = await Promise.all(
        userCategories.map(async (category) => {
          const response = await fetch(
            `/api/leaderboard?type=user&category=${category.id}&month=${selectedMonth}&limit=20`
          );
          if (!response.ok) {
            throw new Error(`Failed to fetch ${category.id} leaderboard`);
          }
          const data = await response.json();
          return { category: category.id, data: data.data || [] };
        })
      );
      
      const newData: Record<UserLeaderboardCategory, LeaderboardUser[]> = {
        'pages-created': [],
        'links-received': [],
        'sponsors-gained': [],
        'page-views': []
      };
      
      results.forEach(result => {
        newData[result.category as UserLeaderboardCategory] = result.data;
      });
      
      setUserLeaderboardData(newData);
    } catch (err) {
      console.error('Error fetching user leaderboards:', err);
      setUserError('Unable to load user leaderboards.');
    } finally {
      setUserLoading(false);
    }
  }, [selectedMonth]);

  // Fetch page leaderboards
  const fetchPageLeaderboards = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    
    try {
      const results = await Promise.all(
        pageCategories.map(async (category) => {
          const response = await fetch(
            `/api/leaderboard?type=page&category=${category.id}&month=${selectedMonth}&limit=20`
          );
          if (!response.ok) {
            throw new Error(`Failed to fetch ${category.id} leaderboard`);
          }
          const data = await response.json();
          return { category: category.id, data: data.data || [] };
        })
      );
      
      const newData: Record<PageLeaderboardCategory, LeaderboardPage[]> = {
        'new-supporters': [],
        'most-replies': [],
        'most-views': [],
        'most-links': []
      };
      
      results.forEach(result => {
        newData[result.category as PageLeaderboardCategory] = result.data;
      });
      
      setPageLeaderboardData(newData);
    } catch (err) {
      console.error('Error fetching page leaderboards:', err);
      setPageError('Unable to load page leaderboards.');
    } finally {
      setPageLoading(false);
    }
  }, [selectedMonth]);

  // Fetch data on mount and when month changes
  useEffect(() => {
    fetchUserLeaderboards();
    fetchPageLeaderboards();
  }, [fetchUserLeaderboards, fetchPageLeaderboards]);

  // Sort categories to put populated ones first
  const sortedUserCategories = useMemo(() => {
    return [...userCategories].sort((a, b) => {
      const aHasData = (userLeaderboardData[a.id]?.length || 0) > 0;
      const bHasData = (userLeaderboardData[b.id]?.length || 0) > 0;
      if (aHasData && !bHasData) return -1;
      if (!aHasData && bHasData) return 1;
      return 0;
    });
  }, [userLeaderboardData]);

  const sortedPageCategories = useMemo(() => {
    return [...pageCategories].sort((a, b) => {
      const aHasData = (pageLeaderboardData[a.id]?.length || 0) > 0;
      const bHasData = (pageLeaderboardData[b.id]?.length || 0) > 0;
      if (aHasData && !bHasData) return -1;
      if (!aHasData && bHasData) return 1;
      return 0;
    });
  }, [pageLeaderboardData]);

  // Render user entry
  const renderUserEntry = (entry: LeaderboardUser, category: UserCategoryConfig, isFirst: boolean = false) => {
    const medalColor = getMedalColor(entry.rank);
    const isCurrentUser = user?.uid === entry.userId;
    const showAnimation = entry.rank <= 3; // Show animation for top 3
    
    return (
      <Link
        key={entry.userId}
        href={`/u/${entry.userId}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center gap-3 hover:bg-muted/50 transition-colors",
          isFirst ? "px-4 py-4" : "px-3 py-2.5",
          isCurrentUser && "bg-primary/5"
        )}
      >
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center",
          isFirst ? "w-10" : "w-6"
        )}>
          {medalColor ? (
            <Icon name="Medal" className={cn(isFirst ? "h-8 w-8" : "h-5 w-5", medalColor)} />
          ) : (
            <span className={cn(
              "font-bold text-muted-foreground",
              isFirst ? "text-lg" : "text-sm"
            )}>
              {entry.rank}
            </span>
          )}
        </div>
        
        {/* Animated column for top performers */}
        {showAnimation && (
          <div className="flex-shrink-0 flex items-center justify-center w-8">
            {entry.rank === 1 && <TrophyAnimation size={isFirst ? 32 : 24} />}
            {entry.rank === 2 && <StarAnimation size={isFirst ? 28 : 20} />}
            {entry.rank === 3 && <FireAnimation size={isFirst ? 24 : 18} />}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium truncate",
            isFirst ? "text-base" : "text-sm",
            isCurrentUser && "text-primary"
          )}>
            {entry.username}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
            )}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn(
            "font-bold",
            isFirst ? "text-lg" : "text-sm"
          )}>
            {entry.count.toLocaleString()}
          </p>
          {isFirst && (
            <p className="text-xs text-muted-foreground">{category.countLabel}</p>
          )}
        </div>
      </Link>
    );
  };

  // Render page entry
  const renderPageEntry = (entry: LeaderboardPage, category: PageCategoryConfig, isFirst: boolean = false) => {
    const medalColor = getMedalColor(entry.rank);
    const showAnimation = entry.rank <= 3; // Show animation for top 3
    
    return (
      <Link
        key={entry.pageId}
        href={`/${entry.pageId}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center gap-3 hover:bg-muted/50 transition-colors",
          isFirst ? "px-4 py-4" : "px-3 py-2.5"
        )}
      >
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center",
          isFirst ? "w-10" : "w-6"
        )}>
          {medalColor ? (
            <Icon name="Medal" className={cn(isFirst ? "h-8 w-8" : "h-5 w-5", medalColor)} />
          ) : (
            <span className={cn(
              "font-bold text-muted-foreground",
              isFirst ? "text-lg" : "text-sm"
            )}>
              {entry.rank}
            </span>
          )}
        </div>
        
        {/* Animated column for top performers */}
        {showAnimation && (
          <div className="flex-shrink-0 flex items-center justify-center w-8">
            {entry.rank === 1 && <TrophyAnimation size={isFirst ? 32 : 24} />}
            {entry.rank === 2 && <StarAnimation size={isFirst ? 28 : 20} />}
            {entry.rank === 3 && <FireAnimation size={isFirst ? 24 : 18} />}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium truncate",
            isFirst ? "text-base" : "text-sm"
          )}>{entry.title}</p>
          <p className="text-xs text-muted-foreground truncate">by {entry.username}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn(
            "font-bold",
            isFirst ? "text-lg" : "text-sm"
          )}>
            {entry.count.toLocaleString()}
          </p>
          {isFirst && (
            <p className="text-xs text-muted-foreground">{category.countLabel}</p>
          )}
        </div>
      </Link>
    );
  };

  // Detail view render
  if (detailView) {
    if (detailView.type === 'user') {
      const category = userCategories.find(c => c.id === detailView.categoryId);
      if (category) {
        return (
          <NavPageLayout maxWidth="2xl">
            <LeaderboardDetailView
              category={category}
              data={userLeaderboardData[category.id] || []}
              loading={userLoading}
              error={userError}
              onRetry={fetchUserLeaderboards}
              onBack={handleCloseDetail}
              selectedMonth={selectedMonth}
              renderEntry={renderUserEntry}
              type="user"
            />
          </NavPageLayout>
        );
      }
    } else {
      const category = pageCategories.find(c => c.id === detailView.categoryId);
      if (category) {
        return (
          <NavPageLayout maxWidth="2xl">
            <LeaderboardDetailView
              category={category}
              data={pageLeaderboardData[category.id] || []}
              loading={pageLoading}
              error={pageError}
              onRetry={fetchPageLeaderboards}
              onBack={handleCloseDetail}
              selectedMonth={selectedMonth}
              renderEntry={renderPageEntry}
              type="page"
            />
          </NavPageLayout>
        );
      }
    }
  }

  return (
    <NavPageLayout maxWidth="2xl">
      {/* Header with Calendar Toggle */}
      <PageHeader
        title="Leaderboards"
        icon="Trophy"
        iconClassName="text-yellow-500"
        className="mb-4 px-4"
        actions={
          <button
            onClick={() => setShowMonthSelector(!showMonthSelector)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              showMonthSelector
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
            aria-label="Select month"
          >
            <Icon name="Calendar" size={16} />
            <span className="text-sm font-medium">
              {selectedMonth === getCurrentMonth() ? 'This month' : formatMonth(selectedMonth)}
            </span>
          </button>
        }
      />

      {/* Month Selector (collapsible) */}
      {showMonthSelector && (
        <div className="mb-6 px-4">
          <MonthSelector 
            selectedMonth={selectedMonth} 
            onMonthChange={handleMonthChange}
            onClose={() => setShowMonthSelector(false)}
          />
        </div>
      )}

      {/* By User Section */}
      <div className="mb-8">
        <LeaderboardCarousel
          title="By User"
          titleIcon="Users"
          categories={sortedUserCategories}
          selectedIndex={userCategoryIndex}
          onSelectIndex={setUserCategoryIndex}
          data={userLeaderboardData}
          loading={userLoading}
          error={userError}
          onRetry={fetchUserLeaderboards}
          renderEntry={renderUserEntry}
          type="user"
          onOpenDetail={handleOpenDetail}
          selectedMonth={selectedMonth}
        />
      </div>

      {/* By Page Section */}
      <div className="mb-4">
        <LeaderboardCarousel
          title="By Page"
          titleIcon="FileStack"
          categories={sortedPageCategories}
          selectedIndex={pageCategoryIndex}
          onSelectIndex={setPageCategoryIndex}
          data={pageLeaderboardData}
          loading={pageLoading}
          error={pageError}
          onRetry={fetchPageLeaderboards}
          renderEntry={renderPageEntry}
          type="page"
          onOpenDetail={handleOpenDetail}
          selectedMonth={selectedMonth}
        />
      </div>
    </NavPageLayout>
  );
}

// Default export with Suspense wrapper
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardLoading />}>
      <LeaderboardContent />
    </Suspense>
  );
}
