import React, { useEffect, useState, useRef } from 'react';
import { PillLink } from "../utils/PillLink";
import { db } from "@/firebase/config";
import { getDatabase } from "firebase/database";
import {collection, query, where, getDocs, doc} from "firebase/firestore";
import {ref, onValue} from "firebase/database";
import {Loader2, ChevronRight, ChevronDown} from "lucide-react";
import { liveReadersService } from "@/services/LiveReadersService";
import { pageStatsService } from "@/services/PageStatsService";
import { pledgeService } from "../services/PledgeService";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import User from "./UserBadge";
import { Sparkline } from "../ui/sparkline";
import FollowButton from "../utils/FollowButton";
import { getPageFollowerCount } from "@/firebase/follows";
import PageMetadataMap from './PageMetadataMap';
import { useFeatureFlag } from "@/utils/feature-flags";

// MetadataItem component for the card layout
const MetadataItem = ({ label, value, showChart = true, sparklineData }) => (
  <div className="w-full max-w-md">
    {/* Desktop: Card layout */}
    <div className="hidden md:flex bg-card dark:bg-neutral-alpha-2 rounded-2xl p-4 items-center justify-between border border-border/40 shadow-sm">
      <span className="text-card-foreground text-base">{label}</span>
      <div className="flex items-center gap-3">
        {value && value !== "None" ? (
          <>
            <div className="bg-card dark:bg-card border border-border/60 px-4 py-1.5 rounded-full text-card-foreground text-base font-medium shadow-sm flex items-center gap-2 transition-all">
              {typeof value === 'object' ? value : (
                <>{value}</>
              )}
            </div>
            {showChart && (
              <div className="w-10 h-4">
                <Sparkline data={sparklineData} width={40} />
              </div>
            )}
          </>
        ) : (
          <span className="text-text-secondary">None</span>
        )}
      </div>
    </div>

    {/* Mobile: List item with divider */}
    <div className="md:hidden flex flex-col">
      <div className="flex items-center justify-between py-4">
        <span className="text-card-foreground text-base">{label}</span>
        <div className="flex items-center gap-3">
          {value && value !== "None" ? (
            <>
              <div className="bg-card dark:bg-card border border-border/60 px-4 py-1.5 rounded-full text-card-foreground text-base font-medium shadow-sm flex items-center gap-2 transition-all">
                {typeof value === 'object' ? value : (
                  <>{value}</>
                )}
              </div>
              {showChart && (
                <div className="w-10 h-4">
                  <Sparkline data={sparklineData} width={40} />
                </div>
              )}
            </>
          ) : (
            <span className="text-text-secondary">None</span>
          )}
        </div>
      </div>
      <div className="h-[1px] bg-border" />
    </div>
  </div>
);

const PageMetadata = ({ page, hidePageOwner = false }) => {
  const { session } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', session?.email);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [relatedPages, setRelatedPages] = useState([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  // Groups functionality removed

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(event.target)) {
        setShowOwnerMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Stats state
  const [liveReaders, setLiveReaders] = useState(1);
  const [recentChanges, setRecentChanges] = useState(0);
  const [totalReaders, setTotalReaders] = useState(0);
  const [supportersStats, setSupportersStats] = useState({ count: 0, totalAmount: 0 });
  const [editorsCount, setEditorsCount] = useState(0);
  const [liveReadersHistory, setLiveReadersHistory] = useState([]);
  const [recentChangesHistory, setRecentChangesHistory] = useState([]);
  const [totalReadersHistory, setTotalReadersHistory] = useState([]);
  const [supportersHistory, setSupportersHistory] = useState([]);
  const [editorsHistory, setEditorsHistory] = useState([]);
  const [incomeHistory, setIncomeHistory] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followerHistory, setFollowerHistory] = useState([]);

  // Groups functionality removed

  // Initialize live readers tracking
  useEffect(() => {
    if (session && page.id) {
      liveReadersService.trackReader(page.id, session.uid);

      const unsubscribe = liveReadersService.subscribeToReaderCount(page.id, (count) => {
        setLiveReaders(count);
      });

      return () => {
        liveReadersService.unsubscribeFromReaderCount(page.id);
        unsubscribe?.();
      };
    }
  }, [page.id, session]);

  // Initialize page stats tracking
  useEffect(() => {
    if (page.id) {
      // Subscribe to recent changes
      const recentChangesUnsubscribe = pageStatsService.subscribeToRecentChanges(
        page.id,
        (count) => setRecentChanges(count)
      );

      // Subscribe to editors count
      const editorsUnsubscribe = pageStatsService.subscribeToEditorsCount(
        page.id,
        (count) => setEditorsCount(count)
      );

      // Get total readers count
      pageStatsService.getTotalReadersCount(page.id).then(setTotalReaders);

      // Subscribe to supporters stats
      const supportersUnsubscribe = pledgeService.subscribeToSupportersStats(
        page.id,
        (stats) => setSupportersStats(stats)
      );

      return () => {
        pageStatsService.unsubscribeFromStats(page.id);
        pledgeService.unsubscribeFromSupportersStats(page.id);
        recentChangesUnsubscribe?.();
        editorsUnsubscribe?.();
        supportersUnsubscribe?.();
      };
    }
  }, [page.id]);

  // Fetch follower count
  useEffect(() => {
    if (page.id) {
      const fetchFollowerCount = async () => {
        try {
          const count = await getPageFollowerCount(page.id);
          setFollowerCount(count);
          // Create a simple history array for the sparkline
          // In a real implementation, you would track this over time
          setFollowerHistory(Array(24).fill(count));
        } catch (error) {
          console.error('Error fetching follower count:', error);
        }
      };

      fetchFollowerCount();
    }
  }, [page.id]);

  // Initialize stats history tracking
  useEffect(() => {
    if (page.id) {
      // Setup history listeners for each metric
      const rtdb = getDatabase();
      const historyRef = ref(rtdb, `pageStats/${page.id}/history`);
      const unsubscribe = onValue(historyRef, (snapshot) => {
        const history = snapshot.val() || {};
        const now = Date.now();
        const last24Hours = Object.entries(history)
          .filter(([timestamp]) => now - parseInt(timestamp) <= 24 * 60 * 60 * 1000)
          .sort(([a], [b]) => parseInt(a) - parseInt(b));

        if (last24Hours.length > 0) {
          setLiveReadersHistory(last24Hours.map(([_, data]) => data.liveReaders || 0));
          setRecentChangesHistory(last24Hours.map(([_, data]) => data.recentChanges || 0));
          setTotalReadersHistory(last24Hours.map(([_, data]) => data.totalReaders || 0));
          setSupportersHistory(last24Hours.map(([_, data]) => data.supporters?.count || 0));
          setEditorsHistory(last24Hours.map(([_, data]) => data.editors || 0));
          setIncomeHistory(last24Hours.map(([_, data]) => data.supporters?.totalAmount || 0));
        }
      });

      return () => unsubscribe();
    }
  }, [page.id]);

  // Fetch related pages
  useEffect(() => {
    const fetchRelatedPages = async () => {
      setIsLoadingRelated(true);
      const firestore = db;
      if (!firestore) {
        console.warn('Firestore not initialized');
        setIsLoadingRelated(false);
        return;
      }

      try {
        const pagesRef = collection(firestore, 'pages');
        const q = query(pagesRef, where('userId', '==', page.userId));
        const querySnapshot = await getDocs(q);

        const pages = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => p.id !== page.id)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 5);

        setRelatedPages(pages);
      } catch (error) {
        console.error('Error fetching related pages:', error);
      }
      setIsLoadingRelated(false);
    };

    if (page.userId) {
      fetchRelatedPages();
    }
  }, [page.userId, page.id]);

  return (
    <div className="bg-card dark:bg-card rounded-2xl p-6 transition-all duration-300 border border-border/40 shadow-sm" data-metadata-section>
      <div
        className="flex items-center gap-2 cursor-pointer mb-6"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className="text-lg font-medium text-card-foreground">Page Metadata</h2>
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className={`space-y-6 overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}>
        {/* Page owner section simplified - no group ownership */}
        {!hidePageOwner && (
          <MetadataItem
            label="Page owner"
            value={
              <div className="flex items-center gap-2">
                <User uid={page.userId} />
              </div>
            }
            showChart={false}
          />
        )}

        {/* Related pages */}
        <div>
          <h3 className="text-muted-foreground mb-2">Related pages</h3>
          {isLoadingRelated ? (
            <div className="bg-card dark:bg-card rounded-2xl p-4 flex items-center justify-center border border-border/40 shadow-sm">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ) : relatedPages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {relatedPages.map(page => (
                <div key={page.id} className="flex-none max-w-full">
                  <PillLink
                    key={page.id}
                    href={`/pages/${page.id}`}
                    className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
                  >
                    {page.title}
                  </PillLink>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card dark:bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
              <span className="text-muted-foreground">No related pages found</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(350px,1fr))] gap-4">
          <MetadataItem
            label="Live readers"
            value={liveReaders}
            sparklineData={liveReadersHistory}
          />
          <MetadataItem
            label="Recent changes"
            value={recentChanges}
            sparklineData={recentChangesHistory}
          />
          {/* Location as the third card */}
          <div className="w-full max-w-md">
            <div className="hidden md:block bg-card dark:bg-neutral-alpha-2 rounded-2xl p-4 border border-border/40 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-card-foreground text-base">Location</span>
              </div>
              <PageMetadataMap location={page.location} />
            </div>
            <div className="md:hidden flex flex-col">
              <div className="flex items-center justify-between py-4">
                <span className="text-card-foreground text-base">Location</span>
              </div>
              <div className="mb-4">
                <PageMetadataMap location={page.location} />
              </div>
              <div className="h-[1px] bg-border"></div>
            </div>
          </div>
          <MetadataItem
            label="Total readers"
            value={totalReaders.toLocaleString()}
            sparklineData={totalReadersHistory}
          />
          {isPaymentsEnabled && (
            <MetadataItem
              label="Supporters"
              value={supportersStats.count > 0 ? supportersStats.count : "None"}
              sparklineData={supportersHistory}
            />
          )}
          <MetadataItem
            label="Editors"
            value={editorsCount > 0 ? editorsCount : "None"}
            sparklineData={editorsHistory}
          />
          {isPaymentsEnabled && (
            <MetadataItem
              label="Page income"
              value={`$${supportersStats.totalAmount.toFixed(2)}/mo`}
              sparklineData={incomeHistory}
            />
          )}
          <MetadataItem
            label="Followers"
            value={typeof followerCount === 'number' ? followerCount : 0}
            sparklineData={followerHistory}
          />
          <MetadataItem
            label="Custom date"
            value={page.customDate || "None"}
            showChart={false}
          />
        </div>
      </div>
    </div>
  );
};

export default PageMetadata;