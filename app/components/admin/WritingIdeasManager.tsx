'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '../ui/use-toast';
import { type WritingIdea } from '../../data/writingIdeas';

interface WritingIdeasManagerProps {
  className?: string;
}

interface StoredWritingIdea extends WritingIdea {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  isNew?: boolean;
}

export function WritingIdeasManager({ className }: WritingIdeasManagerProps) {
  const [ideas, setIdeas] = useState<StoredWritingIdea[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newIdea, setNewIdea] = useState<WritingIdea>({ title: '', placeholder: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Load ideas from API
  const loadIdeas = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/writing-ideas');
      const result = await response.json();

      if (result.success) {
        setIdeas(result.data.ideas || []);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load writing ideas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading ideas:', error);
      toast({
        title: "Error",
        description: "Failed to load writing ideas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIdeas();
  }, []);

  // Filter ideas based on search term
  const filteredIdeas = ideas.filter(idea =>
    idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    idea.placeholder.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsAddingNew(false);
  };

  const handleSave = async (id: string, updatedIdea: WritingIdea) => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/writing-ideas', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          title: updatedIdea.title,
          placeholder: updatedIdea.placeholder
        })
      });

      const result = await response.json();

      if (result.success) {
        setIdeas(prev => prev.map(idea =>
          idea.id === id ? { ...idea, ...updatedIdea, updatedAt: new Date().toISOString() } : idea
        ));
        setEditingId(null);
        toast({
          title: "Success",
          description: "Writing idea updated successfully"
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update writing idea",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating idea:', error);
      toast({
        title: "Error",
        description: "Failed to update writing idea",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this writing idea?')) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/admin/writing-ideas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setIdeas(prev => prev.filter(idea => idea.id !== id));
        toast({
          title: "Success",
          description: "Writing idea deleted successfully"
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete writing idea",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting idea:', error);
      toast({
        title: "Error",
        description: "Failed to delete writing idea",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!newIdea.title.trim() || !newIdea.placeholder.trim()) {
      toast({
        title: "Error",
        description: "Both title and placeholder are required",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/writing-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newIdea.title.trim(),
          placeholder: newIdea.placeholder.trim()
        })
      });

      const result = await response.json();

      if (result.success) {
        const ideaToAdd: StoredWritingIdea = {
          ...result.data.idea,
          isNew: true
        };
        setIdeas(prev => [ideaToAdd, ...prev]);
        setNewIdea({ title: '', placeholder: '' });
        setIsAddingNew(false);
        toast({
          title: "Success",
          description: "Writing idea added successfully"
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add writing idea",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error adding idea:', error);
      toast({
        title: "Error",
        description: "Failed to add writing idea",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setNewIdea({ title: '', placeholder: '' });
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredIdeas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIdeas.map(idea => idea.id)));
    }
  };

  const handleSelectIdea = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedIds.size} writing idea${selectedIds.size > 1 ? 's' : ''}?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsDeleting(true);
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/admin/writing-ideas?id=${encodeURIComponent(id)}`, {
          method: 'DELETE'
        })
      );

      const responses = await Promise.all(deletePromises);
      const results = await Promise.all(responses.map(r => r.json()));

      const successfulDeletes = results.filter(r => r.success).length;
      const failedDeletes = results.length - successfulDeletes;

      if (successfulDeletes > 0) {
        setIdeas(prev => prev.filter(idea => !selectedIds.has(idea.id)));
        setSelectedIds(new Set());

        toast({
          title: "Success",
          description: `${successfulDeletes} writing idea${successfulDeletes > 1 ? 's' : ''} deleted successfully${failedDeletes > 0 ? ` (${failedDeletes} failed)` : ''}`
        });
      }

      if (failedDeletes > 0 && successfulDeletes === 0) {
        toast({
          title: "Error",
          description: "Failed to delete writing ideas",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error bulk deleting ideas:', error);
      toast({
        title: "Error",
        description: "Failed to delete writing ideas",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">Writing Ideas Management</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ideas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="wewrite-input-with-left-icon w-64"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={loadIdeas}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setIsAddingNew(true)}
              disabled={isAddingNew || isLoading || isSaving}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Manage writing ideas that appear when creating new pages. Total: {isLoading ? '...' : ideas.length} ideas
          </p>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                onClick={handleBulkDelete}
                variant="destructive"
                size="sm"
                disabled={isDeleting || isSaving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add New Idea Form */}
          {isAddingNew && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={newIdea.title}
                      onChange={(e) => setNewIdea(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter idea title..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Placeholder Text</label>
                    <Textarea
                      value={newIdea.placeholder}
                      onChange={(e) => setNewIdea(prev => ({ ...prev, placeholder: e.target.value }))}
                      placeholder="Enter placeholder text..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddNew}
                      size="sm"
                      disabled={isSaving || !newIdea.title.trim() || !newIdea.placeholder.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button onClick={handleCancel} variant="secondary" size="sm" disabled={isSaving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ideas List */}
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading writing ideas...</p>
            </div>
          ) : (
            <>
              {filteredIdeas.length > 0 && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredIdeas.length && filteredIdeas.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-border"
                    disabled={isLoading || isSaving || isDeleting}
                  />
                  <label className="text-sm font-medium">
                    Select All ({filteredIdeas.length})
                  </label>
                </div>
              )}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredIdeas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    isEditing={editingId === idea.id}
                    isSelected={selectedIds.has(idea.id)}
                    onSelect={() => handleSelectIdea(idea.id)}
                    onEdit={() => handleEdit(idea.id)}
                    onSave={(updatedIdea) => handleSave(idea.id, updatedIdea)}
                    onDelete={() => handleDelete(idea.id)}
                    onCancel={handleCancel}
                    isSaving={isSaving}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>

              {filteredIdeas.length === 0 && searchTerm && (
                <div className="text-center py-8 text-muted-foreground">
                  No ideas found matching "{searchTerm}"
                </div>
              )}

              {filteredIdeas.length === 0 && !searchTerm && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  No writing ideas found. Add your first idea above.
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface IdeaRowProps {
  idea: StoredWritingIdea;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onSave: (idea: WritingIdea) => void;
  onDelete: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

function IdeaRow({ idea, isEditing, isSelected, onSelect, onEdit, onSave, onDelete, onCancel, isSaving, isDeleting }: IdeaRowProps) {
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editPlaceholder, setEditPlaceholder] = useState(idea.placeholder);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(idea.title);
      setEditPlaceholder(idea.placeholder);
    }
  }, [isEditing, idea]);

  const handleSave = () => {
    if (editTitle.trim() && editPlaceholder.trim()) {
      onSave({ title: editTitle.trim(), placeholder: editPlaceholder.trim() });
    }
  };

  if (isEditing) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Placeholder Text</label>
              <Textarea
                value={editPlaceholder}
                onChange={(e) => setEditPlaceholder(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                size="sm"
                disabled={isSaving || !editTitle.trim() || !editPlaceholder.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button onClick={onCancel} variant="secondary" size="sm" disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="mt-1 rounded border-border"
            disabled={isSaving || isDeleting}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-sm">{idea.title}</h4>
              {idea.isNew && (
                <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
                  New
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {idea.placeholder}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              onClick={onEdit}
              variant="ghost"
              size="sm"
              disabled={isSaving || isDeleting}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={onDelete}
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isSaving || isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
