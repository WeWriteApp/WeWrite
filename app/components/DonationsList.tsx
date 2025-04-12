import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getUserPledges, deletePledge, updatePledge } from '../firebase/subscription';
import { getDocById } from '../firebase/database';
import { ChevronRight, Trash2, X } from 'lucide-react';
import Link from 'next/link';

interface Pledge {
  id: string;
  pageId: string;
  amount: number;
  createdAt: any;
  updatedAt: any;
  title?: string;
}

const DonationsList: React.FC = () => {
  const { user } = useAuth();
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const currentTranslateX = useRef<{ [key: string]: number }>({});
  const isDragging = useRef<boolean>(false);

  useEffect(() => {
    const loadPledges = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get all user pledges
        const userPledges = await getUserPledges(user.uid);

        // Fetch page titles for each pledge
        const pledgesWithTitles = await Promise.all(
          userPledges.map(async (pledge) => {
            try {
              const page = await getDocById('pages', pledge.pageId);
              return {
                ...pledge,
                title: page?.title || 'Unknown Page'
              };
            } catch (err) {
              return {
                ...pledge,
                title: 'Unknown Page'
              };
            }
          })
        );

        // Sort by amount (highest first)
        pledgesWithTitles.sort((a, b) => b.amount - a.amount);

        setPledges(pledgesWithTitles);
      } catch (err: any) {
        setError(err.message || 'Failed to load donations');
      } finally {
        setLoading(false);
      }
    };

    loadPledges();
  }, [user]);

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;

    // Initialize this item's position if it doesn't exist
    if (currentTranslateX.current[id] === undefined) {
      currentTranslateX.current[id] = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (!isDragging.current) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;

    // Only allow swiping left (negative values)
    const newTranslate = Math.min(0, diff + currentTranslateX.current[id]);

    // Update the transform
    if (e.currentTarget) {
      e.currentTarget.style.transform = `translateX(${newTranslate}px)`;
    }

    // If swiped far enough, show delete button
    if (newTranslate < -50) {
      setSwipedItemId(id);
    } else if (id === swipedItemId) {
      setSwipedItemId(null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    isDragging.current = false;

    // If swiped far enough, snap to show delete button
    // Otherwise, snap back to original position
    if (swipedItemId === id) {
      currentTranslateX.current[id] = -80; // Width of delete button
      if (e.currentTarget) {
        e.currentTarget.style.transform = `translateX(-80px)`;
      }
    } else {
      currentTranslateX.current[id] = 0;
      if (e.currentTarget) {
        e.currentTarget.style.transform = `translateX(0)`;
      }
    }
  };

  const resetSwipe = (id: string) => {
    setSwipedItemId(null);
    currentTranslateX.current[id] = 0;
    const element = document.getElementById(`pledge-item-${id}`);
    if (element) {
      element.style.transform = `translateX(0)`;
    }
  };

  const handleDelete = async (pledge: Pledge) => {
    if (!user) return;

    try {
      await deletePledge(user.uid, pledge.pageId, pledge.amount);

      // Remove from local state
      setPledges(pledges.filter(p => p.id !== pledge.id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete donation');
    }
  };

  const handleAdjustAmount = async (pledge: Pledge, change: number) => {
    if (!user) return;

    const newAmount = Math.max(0, pledge.amount + change);

    // If amount is 0, delete the pledge
    if (newAmount === 0) {
      handleDelete(pledge);
      return;
    }

    try {
      await updatePledge(user.uid, pledge.pageId, newAmount, pledge.amount);

      // Update local state
      setPledges(pledges.map(p => {
        if (p.id === pledge.id) {
          return { ...p, amount: newAmount };
        }
        return p;
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to update donation');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
        <p>Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-200 dark:bg-red-800 rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pledges.length === 0) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-muted-foreground">You haven't donated to any pages yet.</p>
        <p className="mt-2 text-sm">
          Visit pages and use the pledge bar to allocate your monthly budget.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pledges.map((pledge) => (
        <div key={pledge.id} className="relative overflow-hidden rounded-lg">
          {/* Delete button (revealed on swipe) */}
          <div
            className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center"
            onClick={() => handleDelete(pledge)}
          >
            <Trash2 className="text-white h-5 w-5" />
          </div>

          {/* Pledge item */}
          <div
            id={`pledge-item-${pledge.id}`}
            className="bg-card border border-border rounded-lg p-4 flex items-center justify-between transition-transform"
            style={{ transform: 'translateX(0)' }}
            onTouchStart={(e) => handleTouchStart(e, pledge.id)}
            onTouchMove={(e) => handleTouchMove(e, pledge.id)}
            onTouchEnd={(e) => handleTouchEnd(e, pledge.id)}
          >
            <div className="flex-1">
              <Link href={`/${pledge.pageId}`} className="font-medium hover:underline">
                {pledge.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                ${pledge.amount.toFixed(2)}/month
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Minus button */}
              <button
                onClick={() => handleAdjustAmount(pledge, -0.1)}
                className="p-1 rounded-full hover:bg-accent"
                aria-label="Decrease donation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                </svg>
              </button>

              {/* Plus button */}
              <button
                onClick={() => handleAdjustAmount(pledge, 0.1)}
                className="p-1 rounded-full hover:bg-accent"
                aria-label="Increase donation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              {swipedItemId === pledge.id ? (
                <button
                  className="p-2 text-muted-foreground"
                  onClick={() => resetSwipe(pledge.id)}
                >
                  <X className="h-5 w-5" />
                </button>
              ) : (
                <Link href={`/${pledge.pageId}`}>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="mt-4 text-xs text-muted-foreground text-center">
        <p>Swipe left on an item to delete it</p>
      </div>
    </div>
  );
};

export default DonationsList;
