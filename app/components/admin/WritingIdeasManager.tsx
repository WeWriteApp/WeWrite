'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { type WritingIdea } from '../../data/writingIdeas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface WritingIdeasManagerProps {
  className?: string;
}

interface StoredWritingIdea extends WritingIdea {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  isNew?: boolean;
  usageCount?: number;
  lastUsedAt?: string;
}

type SortField = 'title' | 'usageCount' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function WritingIdeasManager({ className }: WritingIdeasManagerProps) {
  const [ideas, setIdeas] = useState<StoredWritingIdea[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newIdea, setNewIdea] = useState<WritingIdea>({ title: '', placeholder: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [sortField, setSortField] = useState<SortField>('usageCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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

  // Filter and sort ideas
  const filteredIdeas = ideas
    .filter(idea =>
      idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      idea.placeholder.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'usageCount':
          comparison = (a.usageCount || 0) - (b.usageCount || 0);
          break;
        case 'createdAt':
          comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Calculate total usage for stats
  const totalUsage = ideas.reduce((sum, idea) => sum + (idea.usageCount || 0), 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <Icon name="ArrowUpDown" size={12} className="text-muted-foreground/50" />;
    }
    return sortDirection === 'asc'
      ? <Icon name="ArrowUp" size={12} className="text-primary" />
      : <Icon name="ArrowDown" size={12} className="text-primary" />;
  };

  const handleSave = async (id: string, field: 'title' | 'placeholder', value: string) => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;

    const updatedIdea = { ...idea, [field]: value };

    try {
      setSavingIds(prev => new Set(prev).add(id));
      const response = await fetch('/api/admin/writing-ideas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: updatedIdea.title,
          placeholder: updatedIdea.placeholder
        })
      });

      const result = await response.json();

      if (result.success) {
        setIdeas(prev => prev.map(i =>
          i.id === id ? { ...i, [field]: value, updatedAt: new Date().toISOString() } : i
        ));
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating idea:', error);
      toast({
        title: "Error",
        description: "Failed to update",
        variant: "destructive"
      });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);

    try {
      setSavingIds(prev => new Set(prev).add(id));
      const response = await fetch(`/api/admin/writing-ideas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setIdeas(prev => prev.filter(idea => idea.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast({ title: "Deleted", description: "Writing idea deleted" });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting idea:', error);
      toast({
        title: "Error",
        description: "Failed to delete",
        variant: "destructive"
      });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
      setIsLoading(true);
      const response = await fetch('/api/admin/writing-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        toast({ title: "Added", description: "Writing idea added" });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error adding idea:', error);
      toast({
        title: "Error",
        description: "Failed to add",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
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
  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteConfirm(false);

    try {
      setIsDeleting(true);
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/admin/writing-ideas?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      );

      const responses = await Promise.all(deletePromises);
      const results = await Promise.all(responses.map(r => r.json()));

      const successfulDeletes = results.filter(r => r.success).length;

      if (successfulDeletes > 0) {
        setIdeas(prev => prev.filter(idea => !selectedIds.has(idea.id)));
        setSelectedIds(new Set());
        toast({
          title: "Deleted",
          description: `${successfulDeletes} idea${successfulDeletes > 1 ? 's' : ''} deleted`
        });
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast({
        title: "Error",
        description: "Failed to delete",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Header with search and actions */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <div className="flex-1">
            <Input
              placeholder="Search ideas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Icon name="Search" size={16} />}
              className="max-w-sm"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                onClick={() => setBulkDeleteConfirm(true)}
                variant="destructive"
                size="sm"
                disabled={isDeleting}
              >
                <Icon name="Trash2" size={14} className="mr-1" />
                Delete {selectedIds.size}
              </Button>
            )}
            <Button
              onClick={loadIdeas}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <Icon name="RefreshCw" size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <Button
              onClick={() => setIsAddingNew(true)}
              disabled={isAddingNew || isLoading}
              size="sm"
            >
              <Icon name="Plus" size={14} className="mr-1" />
              Add
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Loading...' : (
            <>
              {filteredIdeas.length} of {ideas.length} ideas
              {totalUsage > 0 && (
                <span className="ml-2 text-primary">• {totalUsage} total uses</span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Add New Row */}
      {isAddingNew && (
        <div className="flex-shrink-0 mb-3 p-3 border border-dashed border-primary rounded-lg bg-primary/5">
          <div className="flex items-center gap-2">
            <Input
              value={newIdea.title}
              onChange={(e) => setNewIdea(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Title..."
              className="flex-1 h-8 text-sm"
            />
            <Input
              value={newIdea.placeholder}
              onChange={(e) => setNewIdea(prev => ({ ...prev, placeholder: e.target.value }))}
              placeholder="Placeholder text..."
              className="flex-[2] h-8 text-sm"
            />
            <Button onClick={handleAddNew} size="sm" className="h-8" disabled={!newIdea.title.trim() || !newIdea.placeholder.trim()}>
              <Icon name="Check" size={14} />
            </Button>
            <Button onClick={() => { setIsAddingNew(false); setNewIdea({ title: '', placeholder: '' }); }} variant="ghost" size="sm" className="h-8">
              <Icon name="X" size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="RefreshCw" size={20} className="animate-spin mr-2" />
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            {searchTerm ? `No ideas matching "${searchTerm}"` : 'No writing ideas yet'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b">
                <th className="w-8 p-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredIdeas.length && filteredIdeas.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="p-2 text-left font-medium text-muted-foreground w-1/4">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Title
                    <SortIcon field="title" />
                  </button>
                </th>
                <th className="p-2 text-left font-medium text-muted-foreground">Placeholder</th>
                <th className="p-2 text-center font-medium text-muted-foreground w-20">
                  <button
                    onClick={() => handleSort('usageCount')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto"
                  >
                    Uses
                    <SortIcon field="usageCount" />
                  </button>
                </th>
                <th className="w-10 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredIdeas.map((idea) => (
                <EditableRow
                  key={idea.id}
                  idea={idea}
                  isSelected={selectedIds.has(idea.id)}
                  isSaving={savingIds.has(idea.id)}
                  onSelect={() => handleSelectIdea(idea.id)}
                  onSave={handleSave}
                  onDelete={() => setDeleteConfirm({ id: idea.id, title: idea.title })}
                  usageCount={idea.usageCount || 0}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Single Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Writing Idea</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Writing Idea{selectedIds.size > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected idea{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteConfirm}>
              Delete {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EditableRowProps {
  idea: StoredWritingIdea;
  isSelected: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onSave: (id: string, field: 'title' | 'placeholder', value: string) => void;
  onDelete: () => void;
  usageCount: number;
}

function EditableRow({ idea, isSelected, isSaving, onSelect, onSave, onDelete, usageCount }: EditableRowProps) {
  const [editingField, setEditingField] = useState<'title' | 'placeholder' | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const handleStartEdit = (field: 'title' | 'placeholder') => {
    setEditingField(field);
    setEditValue(idea[field]);
  };

  const handleSave = () => {
    if (editingField && editValue.trim() && editValue.trim() !== idea[editingField]) {
      onSave(idea.id, editingField, editValue.trim());
    }
    setEditingField(null);
  };

  const handleRevert = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleRevert();
    }
  };

  const hasChanges = editingField && editValue.trim() !== idea[editingField];

  return (
    <tr className={`border-b hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
      <td className="p-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="rounded border-border"
          disabled={isSaving}
        />
      </td>
      <td className="p-2">
        {editingField === 'title' ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              onClick={handleSave}
              size="sm"
              className="h-7 w-7 p-0"
              disabled={!editValue.trim()}
              title="Save (Enter)"
            >
              <Icon name="Check" size={14} />
            </Button>
            <Button
              onClick={handleRevert}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Revert (Escape)"
            >
              <Icon name="X" size={14} />
            </Button>
          </div>
        ) : (
          <div
            className="px-2 py-1 cursor-text hover:bg-muted/50 rounded min-h-[28px] flex items-center"
            onClick={() => handleStartEdit('title')}
          >
            <span className="font-medium">{idea.title}</span>
            {idea.isNew && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded">
                New
              </span>
            )}
          </div>
        )}
      </td>
      <td className="p-2">
        {editingField === 'placeholder' ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              onClick={handleSave}
              size="sm"
              className="h-7 w-7 p-0"
              disabled={!editValue.trim()}
              title="Save (Enter)"
            >
              <Icon name="Check" size={14} />
            </Button>
            <Button
              onClick={handleRevert}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Revert (Escape)"
            >
              <Icon name="X" size={14} />
            </Button>
          </div>
        ) : (
          <div
            className="px-2 py-1 cursor-text hover:bg-muted/50 rounded text-muted-foreground min-h-[28px] flex items-center truncate"
            onClick={() => handleStartEdit('placeholder')}
          >
            {idea.placeholder}
          </div>
        )}
      </td>
      <td className="p-2 text-center">
        <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-xs font-medium rounded-full ${
          usageCount > 0
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}>
          {usageCount}
        </span>
      </td>
      <td className="p-2">
        <Button
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          disabled={isSaving}
        >
          {isSaving ? (
            <Icon name="Loader" size={14} />
          ) : (
            <Icon name="Trash2" size={14} />
          )}
        </Button>
      </td>
    </tr>
  );
}
