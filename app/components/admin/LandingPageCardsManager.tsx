"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  GripVertical, 
  Save, 
  RotateCcw,
  Loader2,
  Search,
  ExternalLink
} from 'lucide-react';
import { useToast } from '../ui/use-toast';
import type { LandingPageCardConfig } from '../../config/landingPageCards';

interface LandingPageCardsManagerProps {
  className?: string;
}

export function LandingPageCardsManager({ className = '' }: LandingPageCardsManagerProps) {
  const { toast } = useToast();
  const [cards, setCards] = useState<LandingPageCardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load current configuration
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/landing-page-cards');
      if (response.ok) {
        const data = await response.json();
        setCards(data.data?.cards || []);
      } else {
        throw new Error('Failed to load cards');
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      toast({
        title: "Error",
        description: "Failed to load landing page cards configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCards = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/landing-page-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cards })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Landing page cards configuration saved successfully"
        });
      } else {
        throw new Error('Failed to save cards');
      }
    } catch (error) {
      console.error('Error saving cards:', error);
      toast({
        title: "Error",
        description: "Failed to save landing page cards configuration",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset to default configuration? This will remove all custom changes.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/landing-page-cards', {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadCards();
        toast({
          title: "Success",
          description: "Landing page cards configuration reset to defaults"
        });
      } else {
        throw new Error('Failed to reset cards');
      }
    } catch (error) {
      console.error('Error resetting cards:', error);
      toast({
        title: "Error",
        description: "Failed to reset landing page cards configuration",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const searchPages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await fetch(`/api/pages/search?q=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data?.pages || []);
      }
    } catch (error) {
      console.error('Error searching pages:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const addCard = () => {
    const newCard: LandingPageCardConfig = {
      id: `card-${Date.now()}`,
      pageId: '',
      customTitle: '',
      buttonText: 'Read more',
      maxLines: 8,
      showAllocationBar: true,
      authorId: 'system',
      allocationSource: 'LandingPageCard',
      className: 'h-full',
      enabled: true
    };
    setCards([...cards, newCard]);
    setEditingCard(newCard.id);
  };

  const deleteCard = (cardId: string) => {
    if (!confirm('Are you sure you want to delete this card?')) {
      return;
    }
    setCards(cards.filter(card => card.id !== cardId));
  };

  const updateCard = (cardId: string, updates: Partial<LandingPageCardConfig>) => {
    setCards(cards.map(card => 
      card.id === cardId ? { ...card, ...updates } : card
    ));
  };

  const moveCard = (cardId: string, direction: 'up' | 'down') => {
    const currentIndex = cards.findIndex(card => card.id === cardId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= cards.length) return;

    const newCards = [...cards];
    [newCards[currentIndex], newCards[newIndex]] = [newCards[newIndex], newCards[currentIndex]];
    setCards(newCards);
  };

  const selectPageForCard = (cardId: string, page: any) => {
    updateCard(cardId, {
      pageId: page.id,
      customTitle: page.title
    });
    setSearchQuery('');
    setSearchResults([]);
    setEditingCard(null);
  };

  if (loading) {
    return (
      <Card className={`wewrite-card ${className}`}>
        <CardHeader>
          <CardTitle>Landing Page Cards Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`wewrite-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Landing Page Cards Manager
          <div className="flex gap-2">
            <Button
              onClick={resetToDefaults}
              variant="secondary"
              size="sm"
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={saveCards}
              disabled={saving}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Card Button */}
        <Button
          onClick={addCard}
          variant="secondary"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Card
        </Button>

        {/* Cards List */}
        <div className="space-y-4">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className="wewrite-card space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <Badge variant="secondary">#{index + 1}</Badge>
                  <span className="font-medium">
                    {card.customTitle || card.pageId || 'Untitled Card'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => moveCard(card.id, 'up')}
                    disabled={index === 0}
                    variant="ghost"
                    size="sm"
                  >
                    ↑
                  </Button>
                  <Button
                    onClick={() => moveCard(card.id, 'down')}
                    disabled={index === cards.length - 1}
                    variant="ghost"
                    size="sm"
                  >
                    ↓
                  </Button>
                  <Button
                    onClick={() => setEditingCard(editingCard === card.id ? null : card.id)}
                    variant="ghost"
                    size="sm"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => deleteCard(card.id)}
                    variant="ghost"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Card Details */}
              {editingCard === card.id ? (
                <div className="space-y-3 border-t pt-3">
                  {/* Page Search */}
                  <div>
                    <Label>Search for Page</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search pages..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchPages(e.target.value);
                        }}
                      />
                      {searchLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                        {searchResults.map((page) => (
                          <div
                            key={page.id}
                            className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => selectPageForCard(card.id, page)}
                          >
                            <div className="font-medium">{page.title}</div>
                            <div className="text-sm text-muted-foreground">{page.id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current Page ID */}
                  <div>
                    <Label>Page ID</Label>
                    <div className="flex gap-2">
                      <Input
                        value={card.pageId}
                        onChange={(e) => updateCard(card.id, { pageId: e.target.value })}
                        placeholder="Enter page ID"
                      />
                      {card.pageId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(`/${card.pageId}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Custom Title */}
                  <div>
                    <Label>Custom Title</Label>
                    <Input
                      value={card.customTitle || ''}
                      onChange={(e) => updateCard(card.id, { customTitle: e.target.value })}
                      placeholder="Override page title (optional)"
                    />
                  </div>

                  {/* Button Text */}
                  <div>
                    <Label>Button Text</Label>
                    <Input
                      value={card.buttonText || ''}
                      onChange={(e) => updateCard(card.id, { buttonText: e.target.value })}
                      placeholder="Read more"
                    />
                  </div>

                  {/* Max Lines */}
                  <div>
                    <Label>Max Lines</Label>
                    <Input
                      type="number"
                      value={card.maxLines || 8}
                      onChange={(e) => updateCard(card.id, { maxLines: parseInt(e.target.value) || 8 })}
                      min="1"
                      max="20"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground border-t pt-3">
                  <div>Page ID: {card.pageId || 'Not set'}</div>
                  <div>Max Lines: {card.maxLines || 8}</div>
                  <div>Button: {card.buttonText || 'Read more'}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {cards.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No cards configured. Click "Add New Card" to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
