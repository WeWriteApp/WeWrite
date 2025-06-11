import React, { useState, useEffect } from 'react';
import { useAuth } from "../../providers/AuthProvider";
import { getUserPledges } from "../../firebase/subscription";
import { getOptimizedUserSubscription } from "../../firebase/optimizedSubscription";
import { getCachedPageTitle } from "../../firebase/database";
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import DonationPieChart from './DonationPieChart';

interface DonationBreakdownChartProps {
  className?: string;
}

interface PledgeData {
  id: string;
  pageId: string;
  amount: number;
  title: string;
  percentage: number;
  color: string;
}

const DonationBreakdownChart: React.FC<DonationBreakdownChartProps> = ({ className }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [pledges, setPledges] = useState<PledgeData[]>([]);
  const [totalPledged, setTotalPledged] = useState(0);
  const [isMaxedOut, setIsMaxedOut] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activePledge, setActivePledge] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user subscription using optimized version
        const userSubscription = await getOptimizedUserSubscription(user.uid, {
          useCache: true,
          cacheTTL: 5 * 60 * 1000, // 5 minutes cache
          verbose: false
        });
        setSubscription(userSubscription);

        // Get all user pledges
        const userPledges = await getUserPledges(user.uid);

        // Calculate total pledged amount
        const total = userPledges.reduce((sum, pledge) => sum + pledge.amount, 0);
        setTotalPledged(total);

        // Check if maxed out
        setIsMaxedOut(userSubscription && total >= userSubscription.amount);

        // Generate colors and fetch titles
        const pledgesWithDetails = await Promise.all(
          userPledges.map(async (pledge, index) => {
            const title = await getCachedPageTitle(pledge.pageId);
            const percentage = userSubscription ?
              (pledge.amount / userSubscription.amount) * 100 : 0;

            return {
              ...pledge,
              title: title || 'Untitled Page',
              percentage,
              color: `hsl(${(index * 30) % 360}, 70%, 60%)`
            };
          })
        );

        // Sort by amount (highest first)
        pledgesWithDetails.sort((a, b) => b.amount - a.amount);
        setPledges(pledgesWithDetails);
      } catch (err: any) {
        console.error('Error loading donation data:', err);
        setError(err.message || 'Failed to load donation data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleMouseDown = (e: React.MouseEvent, pledgeId: string) => {
    setIsDragging(true);
    setActivePledge(pledgeId);
    setStartX(e.clientX);

    // Find the current pledge element and get its width
    const pledgeElement = document.getElementById(`pledge-segment-${pledgeId}`);
    if (pledgeElement) {
      setStartWidth(pledgeElement.offsetWidth);
    }

    // Add event listeners for mouse move and up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !activePledge) return;

    // Calculate the delta movement
    const deltaX = e.clientX - startX;

    // Find the chart container to calculate percentage
    const chartContainer = document.getElementById('donation-chart-container');
    if (!chartContainer) return;

    // Calculate new width as percentage of container
    const containerWidth = chartContainer.offsetWidth;
    const newWidthPercent = Math.max(1, Math.min(100, (startWidth + deltaX) / containerWidth * 100));

    // Find the active pledge
    const activePledgeData = pledges.find(p => p.id === activePledge);
    if (!activePledgeData || !subscription) return;

    // Calculate new amount based on percentage
    const newAmount = (newWidthPercent / 100) * subscription.amount;

    // Update the pledge in the UI (we'll implement actual saving later)
    const updatedPledges = pledges.map(p => {
      if (p.id === activePledge) {
        return {
          ...p,
          amount: newAmount,
          percentage: newWidthPercent
        };
      }
      return p;
    });

    setPledges(updatedPledges);

    // Recalculate total
    const newTotal = updatedPledges.reduce((sum, p) => sum + p.amount, 0);
    setTotalPledged(newTotal);
    setIsMaxedOut(newTotal >= (subscription?.amount || 0));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setActivePledge(null);

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // Here we would save the updated pledge amounts to the database
    // For now, we'll just log the changes
    console.log('Updated pledges:', pledges);
  };

  if (loading) {
    return (
      <div className={cn("bg-card shadow-sm rounded-lg border border-border p-6", className)}>
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4"></div>
        <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800", className)}>
        <p className="text-red-700 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className={cn("bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800", className)}>
        <p className="text-yellow-700 dark:text-yellow-400">You don't have an active subscription yet.</p>
      </div>
    );
  }

  if (pledges.length === 0) {
    return (
      <div className={cn("bg-card shadow-sm rounded-lg border border-border p-6", className)}>
        <h2 className="text-xl font-semibold mb-4">Donation Breakdown</h2>
        <p className="text-muted-foreground">You haven't donated to any pages yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card p-6", className)}>
      {isMaxedOut && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md mb-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 dark:text-amber-400 text-sm">
            Your budget is fully allocated. To donate more, you'll need to increase your subscription amount.
          </p>
        </div>
      )}

      {/* Pie Chart */}
      <DonationPieChart
        pledges={pledges.map(p => ({
          id: p.id,
          pageId: p.pageId,
          title: p.title,
          amount: p.amount
        }))}
        totalAmount={totalPledged}
        maxAmount={subscription.amount}
        className="mb-6"
      />
    </div>
  );
};

export default DonationBreakdownChart;
