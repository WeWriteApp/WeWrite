import React, { useEffect, useState, useContext, useRef } from 'react';
import { PillLink } from './PillLink';
import { getBacklinks, extractPageIds } from '../utils/backlinks';
import { db, rtdb } from '../firebase/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, get, onValue } from 'firebase/database';
import { Icon } from "@iconify/react/dist/iconify.js";
import { liveReadersService } from '../services/LiveReadersService';
import { pageStatsService } from '../services/PageStatsService';
import { pledgeService } from '../services/PledgeService';
import { AuthContext } from '../providers/AuthProvider';
import User from './UserBadge';
import Sparkline from './Sparkline';

// MetadataItem component for the dark card layout
const MetadataItem = ({ label, value, showChart = true, sparklineData }) => (
  <div className="w-full max-w-md">
    {/* Desktop: Card layout */}
    <div className="hidden md:flex bg-background--light dark:bg-background rounded-2xl p-4 items-center justify-between">
      <span className="text-text text-base">{label}</span>
      <div className="flex items-center gap-3">
        {value && value !== "None" ? (
          <>
            <div className="bg-[#0066FF] hover:bg-[#0052CC] px-4 py-1.5 rounded-full text-white text-base font-medium shadow-[0_0_12px_rgba(0,102,255,0.25)] flex items-center gap-2 transition-all">
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
        <span className="text-text text-base">{label}</span>
        <div className="flex items-center gap-3">
          {value && value !== "None" ? (
            <>
              <div className="bg-[#0066FF] hover:bg-[#0052CC] px-4 py-1.5 rounded-full text-white text-base font-medium shadow-[0_0_12px_rgba(0,102,255,0.25)] flex items-center gap-2 transition-all">
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

const BacklinkItem = ({ page }) => {
  return (
    <PillLink 
      href={`/pages/${page.id}`}
      className="transition-opacity"
    >
      {page.title}
    </PillLink>
  );
};

const PageMetadata = ({ page, hidePageOwner = false }) => {
  const { user } = useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [backlinks, setBacklinks] = useState([]);
  const [backlinkPages, setBacklinkPages] = useState([]);
  const [relatedPages, setRelatedPages] = useState([]);
  const [linkedPageIds, setLinkedPageIds] = useState(new Set());
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(true);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const [showBacklinksContext, setShowBacklinksContext] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState('myself');
  const [groups, setGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const ownerMenuRef = useRef(null);
  
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

  // Fetch user's groups
  useEffect(() => {
    const fetchGroups = async () => {
      if (!user?.groups) {
        setGroups([]);
        setIsLoadingGroups(false);
        return;
      }

      try {
        const groupsRef = ref(rtdb, 'groups');
        const snapshot = await get(groupsRef);
        const groupsData = snapshot.val();
        
        if (!groupsData) {
          setGroups([]);
          setIsLoadingGroups(false);
          return;
        }

        const userGroups = Object.entries(groupsData)
          .filter(([id]) => user.groups[id])
          .map(([id, data]) => ({
            id,
            name: data.name,
            memberCount: Object.keys(data.members || {}).length
          }));

        setGroups(userGroups);
        
        // If the page belongs to a group, select it
        if (page.groupId && userGroups.find(g => g.id === page.groupId)) {
          setSelectedOwner(`group-${page.groupId}`);
        } else if (user.uid === page.userId) {
          setSelectedOwner('myself');
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
        setGroups([]);
      }
      
      setIsLoadingGroups(false);
    };

    fetchGroups();
  }, [user, page]);

  // Initialize live readers tracking
  useEffect(() => {
    if (user && page.id) {
      liveReadersService.trackReader(page.id, user.uid);
      
      const unsubscribe = liveReadersService.subscribeToReaderCount(page.id, (count) => {
        setLiveReaders(count);
      });

      return () => {
        liveReadersService.unsubscribeFromReaderCount(page.id);
        unsubscribe?.();
      };
    }
  }, [page.id, user]);

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

  // Initialize stats history tracking
  useEffect(() => {
    if (page.id) {
      // Setup history listeners for each metric
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
      const firestore = db();
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

  // Fetch backlinks
  useEffect(() => {
    const fetchBacklinks = async () => {
      setIsLoadingBacklinks(true);
      const firestore = db();
      if (!firestore) {
        console.warn('Firestore not initialized');
        setIsLoadingBacklinks(false);
        return;
      }

      try {
        const backlinksData = await getBacklinks(page.id);
        setBacklinks(backlinksData);

        // Extract page IDs from content
        const contentIds = extractPageIds(page.content || '');
        setLinkedPageIds(new Set(contentIds));

        // Fetch page data for backlinks
        const pagesRef = collection(firestore, 'pages');
        const backlinkPages = await Promise.all(
          backlinksData.map(async (backlink) => {
            const docRef = doc(firestore, 'pages', backlink.pageId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
          })
        );

        setBacklinkPages(backlinkPages.filter(Boolean));
      } catch (error) {
        console.error('Error fetching backlinks:', error);
      }
      setIsLoadingBacklinks(false);
    };

    if (page.id) {
      fetchBacklinks();
    }
  }, [page.id, page.content]);

  const renderBacklinks = () => {
    if (isLoadingBacklinks) {
      return (
        <div className="bg-background--light dark:bg-background rounded-2xl p-4 flex items-center justify-center">
          <Icon icon="mdi:loading" className="w-5 h-5 text-text-secondary animate-spin" />
        </div>
      );
    }

    if (backlinkPages.length === 0) {
      return (
        <div className="bg-background--light dark:bg-background rounded-2xl p-4">
          <span className="text-text-secondary">No other pages link to this one</span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {backlinkPages.map(page => (
          <BacklinkItem 
            key={page.id} 
            page={page}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 transition-all duration-300">
      <div 
        className="flex items-center gap-2 cursor-pointer mb-6"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className="text-lg font-medium text-text">About page</h2>
        <Icon 
          icon={isCollapsed ? "ph:caret-right-bold" : "ph:caret-down-bold"} 
          className="w-5 h-5 text-text-secondary"
        />
      </div>

      <div className={`space-y-6 overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}>
        {/* Skip the page owner section if hidePageOwner is true */}
        {!hidePageOwner && (
          <div ref={ownerMenuRef}>
            <div 
              onClick={() => setShowOwnerMenu(!showOwnerMenu)}
              className="cursor-pointer"
            >
              <MetadataItem
                label="Page owner"
                value={
                  <div className="flex items-center gap-2">
                    <User uid={page.userId} />
                  </div>
                }
                showChart={false}
              />
            </div>
            {showOwnerMenu && (
              <div className="absolute mt-2 bg-background--light dark:bg-background rounded-2xl p-2 shadow-lg z-50">
                <div className="space-y-2">
                  <div 
                    className={`p-2 rounded-xl flex items-center gap-2 ${selectedOwner === 'myself' ? 'bg-[#0066FF]' : 'hover:bg-background--lighter dark:hover:bg-background--light'}`}
                    onClick={() => {
                      setSelectedOwner('myself');
                      setShowOwnerMenu(false);
                    }}
                  >
                    <User uid={user.uid} />
                    {selectedOwner === 'myself' && (
                      <Icon icon="material-symbols:check" className="text-white ml-auto" />
                    )}
                  </div>
                  {groups.length > 0 && (
                    <>
                      <div className="text-text-secondary text-sm px-2">One of my groups:</div>
                      {groups.map(group => (
                        <div
                          key={group.id}
                          className={`p-2 rounded-xl flex items-center gap-2 ${
                            selectedOwner === `group-${group.id}` ? 'bg-[#0066FF]' : 'hover:bg-background--lighter dark:hover:bg-background--light'
                          }`}
                          onClick={() => {
                            setSelectedOwner(`group-${group.id}`);
                            setShowOwnerMenu(false);
                          }}
                        >
                          <Icon icon="material-symbols:group" className="text-text" />
                          <span className="text-text">{group.name}</span>
                          <span className="text-text-secondary ml-1">∾ {group.memberCount}</span>
                          {selectedOwner === `group-${group.id}` && (
                            <Icon icon="material-symbols:check" className="text-white ml-auto" />
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Related pages */}
        <div>
          <h3 className="text-text-secondary mb-2">Related pages</h3>
          {isLoadingRelated ? (
            <div className="bg-background--light dark:bg-background rounded-2xl p-4 flex items-center justify-center">
              <Icon icon="mdi:loading" className="w-5 h-5 text-text-secondary animate-spin" />
            </div>
          ) : relatedPages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {relatedPages.map(page => (
                <PillLink 
                  key={page.id} 
                  href={`/pages/${page.id}`}
                  className={linkedPageIds.has(page.id) ? "opacity-50" : ""}
                >
                  {page.title}
                </PillLink>
              ))}
            </div>
          ) : (
            <div className="bg-background--light dark:bg-background rounded-2xl p-4">
              <span className="text-text-secondary">No related pages found</span>
            </div>
          )}
        </div>

        {/* Backlinks */}
        <div>
          <h3 className="text-text-secondary mb-2">Backlinks</h3>
          {renderBacklinks()}
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
          <MetadataItem 
            label="Total readers"
            value={totalReaders.toLocaleString()}
            sparklineData={totalReadersHistory}
          />
          <MetadataItem 
            label="Supporters"
            value={supportersStats.count > 0 ? supportersStats.count : "None"}
            sparklineData={supportersHistory}
          />
          <MetadataItem 
            label="Editors"
            value={editorsCount > 0 ? editorsCount : "None"}
            sparklineData={editorsHistory}
          />
          <MetadataItem 
            label="Page income"
            value={`$${supportersStats.totalAmount.toFixed(2)}/mo`}
            sparklineData={incomeHistory}
          />
          <MetadataItem 
            label="Custom date"
            value={page.customDate || "None"}
            showChart={false}
          />
        </div>

        {/* Location */}
        <div>
          <h3 className="text-text-secondary mb-2">Location</h3>
          {page.location ? (
            <div className="w-full h-48 rounded-2xl overflow-hidden bg-background">
              {/* Map component will go here */}
            </div>
          ) : (
            <div className="bg-background--light dark:bg-background rounded-2xl p-4">
              <span className="text-text-secondary">None</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageMetadata;