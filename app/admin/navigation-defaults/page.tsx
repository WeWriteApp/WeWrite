"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ArrowUp, ArrowDown, Plus, X, Save, RotateCcw, Loader2, Home, Search, Bell, User, Settings, Cog, TrendingUp, Clock, Users, Shuffle, Trophy, FileText } from 'lucide-react';
import { useToast } from "../../components/ui/use-toast";
import { cn } from "../../lib/utils";

// All available navigation items
const ALL_ITEMS = [
  'home',
  'search',
  'notifications',
  'profile',
  'leaderboard',
  'random-pages',
  'trending-pages',
  'following',
  'recents',
  'settings',
  'admin',
  'new',
] as const;

// Default orders
const DEFAULT_SIDEBAR_ORDER = [
  'home',
  'search',
  'random-pages',
  'new',
  'trending-pages',
  'following',
  'recents',
  'notifications',
  'profile',
  'settings',
  'admin'
];

const DEFAULT_UNIFIED_MOBILE_ORDER = [
  'home',
  'search',
  'profile',
  'notifications',
  'leaderboard',
  'random-pages',
  'trending-pages',
  'following',
  'recents',
  'settings',
  'admin',
];

// Icon mapping
const getIcon = (id: string) => {
  const icons: Record<string, React.ReactNode> = {
    'home': <Home className="h-4 w-4" />,
    'search': <Search className="h-4 w-4" />,
    'notifications': <Bell className="h-4 w-4" />,
    'profile': <User className="h-4 w-4" />,
    'settings': <Settings className="h-4 w-4" />,
    'admin': <Cog className="h-4 w-4" />,
    'trending-pages': <TrendingUp className="h-4 w-4" />,
    'recents': <Clock className="h-4 w-4" />,
    'following': <Users className="h-4 w-4" />,
    'random-pages': <Shuffle className="h-4 w-4" />,
    'leaderboard': <Trophy className="h-4 w-4" />,
    'new': <FileText className="h-4 w-4" />,
  };
  return icons[id] || <FileText className="h-4 w-4" />;
};

// Format display name
const formatName = (id: string) => {
  return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

interface NavigationDefaults {
  sidebarOrder: string[];
  unifiedMobileOrder: string[];
}

export default function NavigationDefaultsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(DEFAULT_SIDEBAR_ORDER);
  const [unifiedMobileOrder, setUnifiedMobileOrder] = useState<string[]>(DEFAULT_UNIFIED_MOBILE_ORDER);

  // Load current defaults
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await fetch('/api/admin/navigation-defaults');
        if (response.ok) {
          const data: NavigationDefaults = await response.json();
          if (data.sidebarOrder?.length) setSidebarOrder(data.sidebarOrder);
          if (data.unifiedMobileOrder?.length) setUnifiedMobileOrder(data.unifiedMobileOrder);
        }
      } catch (error) {
        console.error('Failed to load defaults:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDefaults();
  }, []);

  // Save defaults
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/navigation-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarOrder, unifiedMobileOrder }),
      });
      
      if (response.ok) {
        toast({
          title: "Saved",
          description: "Navigation defaults have been updated.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save defaults.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
    setUnifiedMobileOrder(DEFAULT_UNIFIED_MOBILE_ORDER);
    toast({
      title: "Reset",
      description: "Navigation order reset to defaults. Save to apply.",
    });
  };

  // Move item up in list
  const moveUp = (list: string[], setList: (l: string[]) => void, index: number) => {
    if (index === 0) return;
    const newList = [...list];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setList(newList);
  };

  // Move item down in list
  const moveDown = (list: string[], setList: (l: string[]) => void, index: number) => {
    if (index === list.length - 1) return;
    const newList = [...list];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setList(newList);
  };

  // Remove item from list
  const removeItem = (list: string[], setList: (l: string[]) => void, index: number) => {
    const newList = [...list];
    newList.splice(index, 1);
    setList(newList);
  };

  // Add item to list
  const addItem = (list: string[], setList: (l: string[]) => void, itemId: string) => {
    if (!list.includes(itemId)) {
      setList([...list, itemId]);
    }
  };

  // Get items not in current list
  const getAvailableItems = (currentList: string[]) => {
    return ALL_ITEMS.filter(item => !currentList.includes(item));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Navigation Defaults</h1>
          <p className="text-muted-foreground">
            Configure the default navigation order for all new users.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Defaults
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Desktop Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>Desktop Sidebar</CardTitle>
            <CardDescription>
              Order of items in the desktop sidebar navigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sidebarOrder.map((itemId, index) => (
              <div
                key={itemId}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <span className="text-muted-foreground w-6 text-sm">{index + 1}.</span>
                {getIcon(itemId)}
                <span className="flex-1 font-medium">{formatName(itemId)}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveUp(sidebarOrder, setSidebarOrder, index)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveDown(sidebarOrder, setSidebarOrder, index)}
                    disabled={index === sidebarOrder.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeItem(sidebarOrder, setSidebarOrder, index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Add items */}
            {getAvailableItems(sidebarOrder).length > 0 && (
              <div className="pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground mb-2">Add items:</p>
                <div className="flex flex-wrap gap-2">
                  {getAvailableItems(sidebarOrder).map(itemId => (
                    <Button
                      key={itemId}
                      variant="secondary"
                      size="sm"
                      onClick={() => addItem(sidebarOrder, setSidebarOrder, itemId)}
                      className="gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      {getIcon(itemId)}
                      {formatName(itemId)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>Mobile Navigation</CardTitle>
            <CardDescription>
              First 4 items appear in toolbar, rest in overflow menu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unifiedMobileOrder.map((itemId, index) => (
              <div
                key={itemId}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                  index < 4 ? "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20" : "bg-card hover:bg-accent/50"
                )}
              >
                <span className="text-muted-foreground w-6 text-sm">{index + 1}.</span>
                {getIcon(itemId)}
                <span className="flex-1 font-medium">{formatName(itemId)}</span>
                {index < 4 && (
                  <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
                    Toolbar
                  </span>
                )}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveUp(unifiedMobileOrder, setUnifiedMobileOrder, index)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveDown(unifiedMobileOrder, setUnifiedMobileOrder, index)}
                    disabled={index === unifiedMobileOrder.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeItem(unifiedMobileOrder, setUnifiedMobileOrder, index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Add items */}
            {getAvailableItems(unifiedMobileOrder).length > 0 && (
              <div className="pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground mb-2">Add items:</p>
                <div className="flex flex-wrap gap-2">
                  {getAvailableItems(unifiedMobileOrder).map(itemId => (
                    <Button
                      key={itemId}
                      variant="secondary"
                      size="sm"
                      onClick={() => addItem(unifiedMobileOrder, setUnifiedMobileOrder, itemId)}
                      className="gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      {getIcon(itemId)}
                      {formatName(itemId)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">How This Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Desktop Sidebar:</strong> Controls the order of navigation items in the left sidebar on desktop screens.
          </p>
          <p>
            <strong>Mobile Navigation:</strong> Controls the mobile bottom bar. The first 4 items appear in the always-visible toolbar, 
            while remaining items are accessible via the overflow menu.
          </p>
          <p>
            <strong>Note:</strong> These defaults apply to new users. Existing users who have customized their navigation 
            will keep their personal settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
