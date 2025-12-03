"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { isAdmin } from '../../utils/isAdmin';
import { FloatingHeader } from '../../components/ui/FloatingCard';
import { 
  X, 
  Loader, 
  GripVertical, 
  Smartphone, 
  Monitor, 
  RotateCcw,
  Save,
  Home,
  Search,
  Bell,
  User,
  Settings,
  Shield,
  Shuffle,
  TrendingUp,
  Users,
  Clock,
  Trophy,
  Plus
} from 'lucide-react';

// Navigation item configuration
const NAV_ITEM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  'home': { label: 'Home', icon: Home },
  'search': { label: 'Search', icon: Search },
  'new': { label: 'New', icon: Plus },
  'notifications': { label: 'Notifications', icon: Bell },
  'random-pages': { label: 'Random', icon: Shuffle },
  'trending-pages': { label: 'Trending', icon: TrendingUp },
  'following': { label: 'Following', icon: Users },
  'recents': { label: 'Recents', icon: Clock },
  'settings': { label: 'Settings', icon: Settings },
  'admin': { label: 'Admin', icon: Shield },
  'profile': { label: 'Profile', icon: User },
  'leaderboard': { label: 'Leaderboard', icon: Trophy },
};

interface NavItemProps {
  itemId: string;
  index: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRemove?: () => void;
  showRemove?: boolean;
}

function NavItem({ itemId, index, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onRemove, showRemove }: NavItemProps) {
  const config = NAV_ITEM_CONFIG[itemId];
  if (!config) return null;
  
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium w-6">{index + 1}.</span>
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-sm">{config.label}</span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveUp}
          disabled={!canMoveUp}
        >
          <span className="text-xs">↑</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveDown}
          disabled={!canMoveDown}
        >
          <span className="text-xs">↓</span>
        </Button>
        {showRemove && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface AddableItemProps {
  itemId: string;
  onAdd: () => void;
}

function AddableItem({ itemId, onAdd }: AddableItemProps) {
  const config = NAV_ITEM_CONFIG[itemId];
  if (!config) return null;
  
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-background border border-dashed rounded-md opacity-60">
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-sm">{config.label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onAdd}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function NavigationDefaultsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allNavItems, setAllNavItems] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  // Navigation orders
  const [mobileToolbar, setMobileToolbar] = useState<string[]>([]);
  const [desktopSidebar, setDesktopSidebar] = useState<string[]>([]);
  const [unifiedMobile, setUnifiedMobile] = useState<string[]>([]);

  // Original values for reset
  const [originalMobileToolbar, setOriginalMobileToolbar] = useState<string[]>([]);
  const [originalDesktopSidebar, setOriginalDesktopSidebar] = useState<string[]>([]);
  const [originalUnifiedMobile, setOriginalUnifiedMobile] = useState<string[]>([]);

  // Load current defaults
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await fetch('/api/admin/navigation-defaults');
        if (!response.ok) {
          throw new Error('Failed to fetch navigation defaults');
        }
        const result = await response.json();
        if (result.success) {
          setMobileToolbar(result.data.mobileToolbar);
          setDesktopSidebar(result.data.desktopSidebar);
          setUnifiedMobile(result.data.unifiedMobile);
          setAllNavItems(result.data.allNavItems);
          setLastUpdated(result.data.lastUpdated);
          setUpdatedBy(result.data.updatedBy);
          
          // Save originals for reset
          setOriginalMobileToolbar(result.data.mobileToolbar);
          setOriginalDesktopSidebar(result.data.desktopSidebar);
          setOriginalUnifiedMobile(result.data.unifiedMobile);
        }
      } catch (error) {
        console.error('Error loading navigation defaults:', error);
        toast({
          title: 'Error',
          description: 'Failed to load navigation defaults',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user && !authLoading) {
      loadDefaults();
    }
  }, [user, authLoading, toast]);

  // Check admin access
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/navigation-defaults');
    }
  }, [user, authLoading, router]);

  // Helper functions for reordering
  const moveItem = (list: string[], setList: (items: string[]) => void, fromIndex: number, toIndex: number) => {
    const newList = [...list];
    const [item] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, item);
    setList(newList);
  };

  const removeItem = (list: string[], setList: (items: string[]) => void, index: number) => {
    const newList = [...list];
    newList.splice(index, 1);
    setList(newList);
  };

  const addItem = (list: string[], setList: (items: string[]) => void, itemId: string) => {
    if (!list.includes(itemId)) {
      setList([...list, itemId]);
    }
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/navigation-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileToolbar,
          desktopSidebar,
          unifiedMobile
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      const result = await response.json();
      
      // Update originals
      setOriginalMobileToolbar(mobileToolbar);
      setOriginalDesktopSidebar(desktopSidebar);
      setOriginalUnifiedMobile(unifiedMobile);
      setLastUpdated(new Date().toISOString());
      setUpdatedBy(user?.email || null);

      toast({
        title: 'Saved',
        description: 'Navigation defaults updated successfully',
      });
    } catch (error) {
      console.error('Error saving navigation defaults:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save navigation defaults',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original
  const handleReset = () => {
    setMobileToolbar([...originalMobileToolbar]);
    setDesktopSidebar([...originalDesktopSidebar]);
    setUnifiedMobile([...originalUnifiedMobile]);
    toast({
      title: 'Reset',
      description: 'Changes discarded',
    });
  };

  // Check if there are unsaved changes
  const hasChanges = 
    JSON.stringify(mobileToolbar) !== JSON.stringify(originalMobileToolbar) ||
    JSON.stringify(desktopSidebar) !== JSON.stringify(originalDesktopSidebar) ||
    JSON.stringify(unifiedMobile) !== JSON.stringify(originalUnifiedMobile);

  // Get items not in a list
  const getAvailableItems = (currentList: string[]) => {
    return allNavItems.filter(item => !currentList.includes(item));
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-4xl">
        <FloatingHeader className="fixed top-3 left-3 right-3 sm:left-4 sm:right-4 md:left-6 md:right-6 z-40 px-4 py-3 mb-6 flex items-center justify-between lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Navigation Defaults</h1>
            <p className="text-sm text-muted-foreground">
              Configure default navigation order for all users
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin')}
              className="h-9 w-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </FloatingHeader>

        <div className="space-y-6 pt-24 lg:pt-0">
          {/* Info banner */}
          <div className="bg-muted/50 border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              These defaults are used when a user hasn't customized their own navigation. 
              Changes here will affect new users and users who reset their navigation to defaults.
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-2">
                Last updated: {new Date(lastUpdated).toLocaleString()} 
                {updatedBy && ` by ${updatedBy}`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Desktop Sidebar */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Desktop Sidebar</CardTitle>
                </div>
                <CardDescription>
                  Order of items in the desktop sidebar navigation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {desktopSidebar.map((itemId, index) => (
                    <NavItem
                      key={itemId}
                      itemId={itemId}
                      index={index}
                      onMoveUp={() => moveItem(desktopSidebar, setDesktopSidebar, index, index - 1)}
                      onMoveDown={() => moveItem(desktopSidebar, setDesktopSidebar, index, index + 1)}
                      canMoveUp={index > 0}
                      canMoveDown={index < desktopSidebar.length - 1}
                      onRemove={() => removeItem(desktopSidebar, setDesktopSidebar, index)}
                      showRemove={true}
                    />
                  ))}
                </div>
                
                {/* Available items to add */}
                {getAvailableItems(desktopSidebar).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Available to add:</p>
                    <div className="space-y-1">
                      {getAvailableItems(desktopSidebar).map(itemId => (
                        <AddableItem
                          key={itemId}
                          itemId={itemId}
                          onAdd={() => addItem(desktopSidebar, setDesktopSidebar, itemId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unified Mobile Nav */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Mobile Navigation</CardTitle>
                </div>
                <CardDescription>
                  First 4 items appear in toolbar, rest in overflow menu
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {unifiedMobile.map((itemId, index) => (
                    <div key={itemId}>
                      {index === 4 && (
                        <div className="my-3 flex items-center gap-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground">Overflow menu</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <NavItem
                        itemId={itemId}
                        index={index}
                        onMoveUp={() => moveItem(unifiedMobile, setUnifiedMobile, index, index - 1)}
                        onMoveDown={() => moveItem(unifiedMobile, setUnifiedMobile, index, index + 1)}
                        canMoveUp={index > 0}
                        canMoveDown={index < unifiedMobile.length - 1}
                        onRemove={() => removeItem(unifiedMobile, setUnifiedMobile, index)}
                        showRemove={true}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Available items to add */}
                {getAvailableItems(unifiedMobile).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Available to add:</p>
                    <div className="space-y-1">
                      {getAvailableItems(unifiedMobile).map(itemId => (
                        <AddableItem
                          key={itemId}
                          itemId={itemId}
                          onAdd={() => addItem(unifiedMobile, setUnifiedMobile, itemId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Legacy Mobile Toolbar - for backwards compatibility */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg text-muted-foreground">Legacy Mobile Toolbar</CardTitle>
                <Badge variant="secondary" className="text-xs">Deprecated</Badge>
              </div>
              <CardDescription>
                Old 3-item mobile toolbar. Keep for backwards compatibility.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 opacity-75">
                {mobileToolbar.map((itemId, index) => (
                  <NavItem
                    key={itemId}
                    itemId={itemId}
                    index={index}
                    onMoveUp={() => moveItem(mobileToolbar, setMobileToolbar, index, index - 1)}
                    onMoveDown={() => moveItem(mobileToolbar, setMobileToolbar, index, index + 1)}
                    canMoveUp={index > 0}
                    canMoveDown={index < mobileToolbar.length - 1}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                ⚠️ This is the old mobile toolbar format (exactly 3 items). 
                Most users now use the Unified Mobile Navigation above.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
