"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { ChevronLeft, ChevronUp, ChevronDown, Eye, EyeOff, Search, Loader, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import { isAdmin } from '../../utils/isAdmin';
import Link from 'next/link';

interface LandingPageCard {
  id: string;
  pageId: string;
  title: string;
  username: string;
  description: string;
  isVisible: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function LandingCardsManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [cards, setCards] = useState<LandingPageCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      } else {
        loadLandingCards();
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/landing-cards');
    }
  }, [user, authLoading, router]);

  // Load current landing page cards
  const loadLandingCards = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/landing-cards');
      
      if (response.ok) {
        const data = await response.json();
        setCards(data.cards || []);
      } else {
        throw new Error('Failed to load landing cards');
      }
    } catch (error) {
      console.error('Error loading landing cards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load landing page cards',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Search for pages to add
  const searchPages = async () => {
    if (!searchTerm.trim()) return;

    try {
      setIsSearching(true);
      const response = await fetch(`/api/admin/search-pages?q=${encodeURIComponent(searchTerm)}`);
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.pages || []);
      } else {
        throw new Error('Failed to search pages');
      }
    } catch (error) {
      console.error('Error searching pages:', error);
      toast({
        title: 'Error',
        description: 'Failed to search pages',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Add page to landing cards
  const addPageToLanding = async (page: any) => {
    try {
      const response = await fetch('/api/admin/landing-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          title: page.title,
          username: page.username,
          description: page.description || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCards(prev => [...prev, data.card]);
        setSearchResults(prev => prev.filter(p => p.id !== page.id));
        toast({
          title: 'Success',
          description: 'Page added to landing page',
          variant: 'default'
        });
      } else {
        throw new Error('Failed to add page');
      }
    } catch (error) {
      console.error('Error adding page:', error);
      toast({
        title: 'Error',
        description: 'Failed to add page to landing',
        variant: 'destructive'
      });
    }
  };

  // Remove page from landing cards
  const removePageFromLanding = async (cardId: string) => {
    try {
      const response = await fetch(`/api/admin/landing-cards/${cardId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCards(prev => prev.filter(card => card.id !== cardId));
        toast({
          title: 'Success',
          description: 'Page removed from landing page',
          variant: 'default'
        });
      } else {
        throw new Error('Failed to remove page');
      }
    } catch (error) {
      console.error('Error removing page:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove page from landing',
        variant: 'destructive'
      });
    }
  };

  // Toggle visibility
  const toggleVisibility = (cardId: string) => {
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, isVisible: !card.isVisible } : card
    ));
  };

  // Move card up/down in order
  const moveCard = (cardId: string, direction: 'up' | 'down') => {
    setCards(prev => {
      const sortedCards = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
      const currentIndex = sortedCards.findIndex(card => card.id === cardId);
      
      if (direction === 'up' && currentIndex > 0) {
        [sortedCards[currentIndex], sortedCards[currentIndex - 1]] = 
        [sortedCards[currentIndex - 1], sortedCards[currentIndex]];
      } else if (direction === 'down' && currentIndex < sortedCards.length - 1) {
        [sortedCards[currentIndex], sortedCards[currentIndex + 1]] = 
        [sortedCards[currentIndex + 1], sortedCards[currentIndex]];
      }
      
      // Update display orders
      return sortedCards.map((card, index) => ({
        ...card,
        displayOrder: index + 1
      }));
    });
  };

  // Save changes
  const saveChanges = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/landing-cards/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Landing page cards updated successfully',
          variant: 'default'
        });
      } else {
        throw new Error('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading landing page management...</p>
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

  const sortedCards = [...cards].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center text-blue-500 hover:text-blue-600">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Link>
          <h1 className="text-3xl font-bold mt-4 mb-2">
            Landing Page Cards Management
          </h1>
          <p className="text-muted-foreground">
            Manage which pages appear on the landing page and control their display order
          </p>
        </div>

        <div className="space-y-6">
          {/* Add New Page Section */}
          <Card>
            <CardHeader>
              <CardTitle>Add Page to Landing</CardTitle>
              <CardDescription>
                Search for pages to add to the landing page carousel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search by page title or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchPages()}
                />
                <Button
                  variant="outline"
                  onClick={searchPages}
                  disabled={isSearching || !searchTerm.trim()}
                >
                  {isSearching ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Search Results</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map(page => (
                      <div
                        key={page.id}
                        className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{page.title}</div>
                          <div className="text-sm text-muted-foreground">by {page.username}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addPageToLanding(page)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Landing Cards */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Current Landing Page Cards</CardTitle>
                <CardDescription>
                  Manage the order and visibility of pages on the landing page
                </CardDescription>
              </div>
              <Button
                onClick={saveChanges}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </CardHeader>
            <CardContent>
              {sortedCards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pages added to landing page yet
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedCards.map((card, index) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 p-4 rounded-lg border bg-card"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveCard(card.id, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveCard(card.id, 'down')}
                          disabled={index === sortedCards.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex-1">
                        <div className="font-medium">{card.title}</div>
                        <div className="text-sm text-muted-foreground">by {card.username}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Order: {card.displayOrder}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={card.isVisible}
                            onCheckedChange={() => toggleVisibility(card.id)}
                          />
                          <span className="text-sm">
                            {card.isVisible ? (
                              <Badge variant="default" className="gap-1">
                                <Eye className="h-3 w-3" />
                                Visible
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <EyeOff className="h-3 w-3" />
                                Hidden
                              </Badge>
                            )}
                          </span>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePageFromLanding(card.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
