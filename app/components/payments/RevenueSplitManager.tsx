"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '../ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from '../ui/select';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  Percent,
  AlertCircle
} from 'lucide-react';

interface RevenueSplit {
  id: string;
  resourceType: 'page' | 'group';
  resourceId: string;
  splits: RevenueSplitEntry[];
  totalPercentage: number;
  isActive: boolean;
}

interface RevenueSplitEntry {
  recipientId: string;
  recipientType: 'user' | 'platform';
  percentage: number;
  role: 'owner' | 'contributor' | 'early_supporter' | 'platform_fee';
}

interface RevenueSplitManagerProps {
  resourceType: 'page' | 'group';
  resourceId: string;
  resourceTitle: string;
  onUpdate?: () => void;
}

export default function RevenueSplitManager({
  resourceType,
  resourceId,
  resourceTitle,
  onUpdate
}: RevenueSplitManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  
  const [revenueSplit, setRevenueSplit] = useState<RevenueSplit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContributor, setNewContributor] = useState({
    userId: '',
    percentage: 10,
    role: 'contributor'
  });

  useEffect(() => {
    if (user) {
      loadRevenueSplit();
    }
  }, [user, resourceType, resourceId]);

  const loadRevenueSplit = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `/api/payouts/revenue-splits?resourceType=${resourceType}&resourceId=${resourceId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setRevenueSplit(data.data);
      }
    } catch (error) {
      console.error('Error loading revenue split:', error);
      toast({
        title: "Error",
        description: "Failed to load revenue split configuration",
        variant: "destructive"});
    } finally {
      setLoading(false);
    }
  };

  const addContributor = async () => {
    if (!newContributor.userId || newContributor.percentage <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid user ID and percentage",
        variant: "destructive"});
      return;
    }

    try {
      setSaving(true);
      
      const response = await fetch('/api/payouts/revenue-splits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_contributor',
          resourceType,
          resourceId,
          contributorId: newContributor.userId,
          percentage: newContributor.percentage
        })
      });
      
      if (response.ok) {
        toast({
          title: "Contributor Added",
          description: "Revenue split updated successfully"});
        setShowAddDialog(false);
        setNewContributor({ userId: '', percentage: 10, role: 'contributor' });
        loadRevenueSplit();
        onUpdate?.();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Failed to Add Contributor",
        description: error.message || "Please try again",
        variant: "destructive"});
    } finally {
      setSaving(false);
    }
  };

  const updateRevenueSplit = async (newSplits: any[]) => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/payouts/revenue-splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          resourceId,
          splits: newSplits
        })
      });
      
      if (response.ok) {
        loadRevenueSplit();
        onUpdate?.();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Please try again",
        variant: "destructive"});
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      owner: { variant: 'default' as const, label: 'Owner' },
      contributor: { variant: 'secondary' as const, label: 'Contributor' },
      early_supporter: { variant: 'outline' as const, label: 'Early Supporter' },
      platform_fee: { variant: 'destructive' as const, label: 'Platform Fee' }
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.contributor;
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  // Payments are always enabled - no feature flag check needed

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Loading revenue split...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Revenue Split
              </CardTitle>
              <CardDescription>
                Configure how earnings from "{resourceTitle}" are distributed
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
              disabled={!revenueSplit}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Contributor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!revenueSplit ? (
            <div className="text-center py-6">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Revenue Split Configured</h3>
              <p className="text-muted-foreground mb-4">
                Set up revenue splitting to share earnings with contributors.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Split Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Creator Share</span>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    {revenueSplit.splits
                      .filter(s => s.recipientType === 'user')
                      .reduce((sum, s) => sum + s.percentage, 0)
                      .toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Percent className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Platform Fee</span>
                  </div>
                  <p className="text-xl font-bold text-primary">
                    {revenueSplit.splits
                      .filter(s => s.recipientType === 'platform')
                      .reduce((sum, s) => sum + s.percentage, 0)
                      .toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Contributors</span>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {revenueSplit.splits.filter(s => s.role === 'contributor').length}
                  </p>
                </div>
              </div>

              {/* Split Details */}
              <div className="space-y-2">
                <h4 className="font-medium">Revenue Distribution</h4>
                {revenueSplit.splits.map((split, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getRoleBadge(split.role)}
                      <div>
                        <p className="font-medium">
                          {split.recipientType === 'platform' 
                            ? 'WeWrite Platform' 
                            : split.recipientId.replace('recipient_', '')
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {split.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{split.percentage.toFixed(1)}%</p>
                      {split.recipientType === 'user' && split.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Check */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Distribution</span>
                  <span className={`font-bold ${
                    Math.abs(revenueSplit.totalPercentage - 100) < 0.01 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {revenueSplit.totalPercentage.toFixed(1)}%
                  </span>
                </div>
                {Math.abs(revenueSplit.totalPercentage - 100) > 0.01 && (
                  <p className="text-sm text-red-600 mt-1">
                    Revenue splits must total 100%
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Contributor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contributor</DialogTitle>
            <DialogDescription>
              Add a contributor to share revenue from this {resourceType}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contributor-id">User ID</Label>
              <Input
                id="contributor-id"
                value={newContributor.userId}
                onChange={(e) => setNewContributor(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Enter user ID"
              />
            </div>
            <div>
              <Label htmlFor="contributor-percentage">Percentage</Label>
              <Input
                id="contributor-percentage"
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={newContributor.percentage}
                onChange={(e) => setNewContributor(prev => ({ ...prev, percentage: parseFloat(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be deducted from the owner's share
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addContributor} disabled={saving}>
              {saving ? 'Adding...' : 'Add Contributor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}