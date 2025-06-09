"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Heart, ExternalLink, Trash2, Edit3, DollarSign } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { listenToUserPledges, updatePledge, deletePledge } from '../../firebase/subscription';
import { getDocById } from '../../firebase/database';
import { useToast } from '../ui/use-toast';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface Pledge {
  id: string;
  pageId: string;
  amount: number;
  createdAt: any;
  updatedAt: any;
  title?: string;
  authorName?: string;
  isPublic?: boolean;
}

export function PledgesList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [deletingPledge, setDeletingPledge] = useState<Pledge | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToUserPledges(user.uid, async (pledgesData) => {
      try {
        // Fetch page details for each pledge
        const pledgesWithDetails = await Promise.all(
          pledgesData.map(async (pledge) => {
            try {
              const pageData = await getDocById('pages', pledge.pageId);
              return {
                ...pledge,
                title: pageData?.title || 'Untitled Page',
                authorName: pageData?.authorName || 'Unknown Author',
                isPublic: pageData?.isPublic || false,
              };
            } catch (err) {
              console.error(`Error fetching page data for ${pledge.pageId}:`, err);
              return {
                ...pledge,
                title: 'Untitled Page',
                authorName: 'Unknown Author',
                isPublic: false,
              };
            }
          })
        );

        // Sort by amount (highest first)
        pledgesWithDetails.sort((a, b) => b.amount - a.amount);
        setPledges(pledgesWithDetails);
        setError(null);
      } catch (err: any) {
        console.error('Error processing pledges:', err);
        setError(err.message || 'Failed to load pledges');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleEditPledge = (pledge: Pledge) => {
    setEditingPledge(pledge);
    setEditAmount(pledge.amount.toString());
  };

  const handleUpdatePledge = async () => {
    if (!editingPledge || !user) return;

    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(true);
      await updatePledge(user.uid, editingPledge.pageId, newAmount, editingPledge.amount);
      
      toast({
        title: "Pledge Updated",
        description: `Your pledge to "${editingPledge.title}" has been updated to $${newAmount.toFixed(2)}/month.`,
      });
      
      setEditingPledge(null);
      setEditAmount('');
    } catch (err: any) {
      console.error('Error updating pledge:', err);
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update pledge.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePledge = async () => {
    if (!deletingPledge || !user) return;

    try {
      setActionLoading(true);
      await deletePledge(user.uid, deletingPledge.pageId, deletingPledge.amount);
      
      toast({
        title: "Pledge Removed",
        description: `Your pledge to "${deletingPledge.title}" has been removed.`,
      });
      
      setDeletingPledge(null);
    } catch (err: any) {
      console.error('Error deleting pledge:', err);
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to remove pledge.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const totalPledgedAmount = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Pledges
          </CardTitle>
          <CardDescription>Pages you're supporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Pledges
          </CardTitle>
          <CardDescription>Pages you're supporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Pledges
          </CardTitle>
          <CardDescription>
            Pages you're supporting
            {pledges.length > 0 && (
              <span className="ml-2">
                • Total: <span className="font-medium">${totalPledgedAmount.toFixed(2)}/month</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pledges.length === 0 ? (
            <div className="py-8 text-center">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No pledges yet</h3>
              <p className="text-muted-foreground mb-4">
                Start supporting pages you love by visiting them and making a pledge.
              </p>
              <Button variant="outline" asChild>
                <Link href="/">Browse Pages</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {pledges.map((pledge) => (
                <div
                  key={pledge.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/${pledge.pageId}`}
                        className="font-medium text-foreground hover:text-primary transition-colors truncate"
                      >
                        {pledge.title}
                      </Link>
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      {!pledge.isPublic && (
                        <Badge variant="secondary" className="text-xs">Private</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">by {pledge.authorName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 font-medium">
                        <DollarSign className="h-4 w-4" />
                        {pledge.amount.toFixed(2)}/mo
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPledge(pledge)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingPledge(pledge)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Pledge Dialog */}
      <Dialog open={!!editingPledge} onOpenChange={() => setEditingPledge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pledge</DialogTitle>
            <DialogDescription>
              Update your monthly pledge to "{editingPledge?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="amount">Monthly Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPledge(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePledge} disabled={actionLoading}>
              {actionLoading ? 'Updating...' : 'Update Pledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pledge Dialog */}
      <Dialog open={!!deletingPledge} onOpenChange={() => setDeletingPledge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Pledge</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop supporting "{deletingPledge?.title}"? 
              This will remove your ${deletingPledge?.amount.toFixed(2)}/month pledge.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPledge(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePledge} disabled={actionLoading}>
              {actionLoading ? 'Removing...' : 'Remove Pledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
