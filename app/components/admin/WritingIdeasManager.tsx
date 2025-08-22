'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { writingIdeas, type WritingIdea } from '../../data/writingIdeas';

interface WritingIdeasManagerProps {
  className?: string;
}

interface EditingIdea extends WritingIdea {
  id: number;
  isNew?: boolean;
}

export function WritingIdeasManager({ className }: WritingIdeasManagerProps) {
  const [ideas, setIdeas] = useState<EditingIdea[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newIdea, setNewIdea] = useState<WritingIdea>({ title: '', placeholder: '' });

  // Initialize ideas with IDs
  useEffect(() => {
    const ideasWithIds = writingIdeas.map((idea, index) => ({
      ...idea,
      id: index
    }));
    setIdeas(ideasWithIds);
  }, []);

  // Filter ideas based on search term
  const filteredIdeas = ideas.filter(idea =>
    idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    idea.placeholder.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsAddingNew(false);
  };

  const handleSave = (id: number, updatedIdea: WritingIdea) => {
    setIdeas(prev => prev.map(idea => 
      idea.id === id ? { ...idea, ...updatedIdea } : idea
    ));
    setEditingId(null);
    // TODO: Save to backend/file system
    console.log('Saving idea:', updatedIdea);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this writing idea?')) {
      setIdeas(prev => prev.filter(idea => idea.id !== id));
      // TODO: Delete from backend/file system
      console.log('Deleting idea with id:', id);
    }
  };

  const handleAddNew = () => {
    if (newIdea.title.trim() && newIdea.placeholder.trim()) {
      const newId = Math.max(...ideas.map(i => i.id)) + 1;
      const ideaToAdd: EditingIdea = {
        ...newIdea,
        id: newId,
        isNew: true
      };
      setIdeas(prev => [ideaToAdd, ...prev]);
      setNewIdea({ title: '', placeholder: '' });
      setIsAddingNew(false);
      // TODO: Save to backend/file system
      console.log('Adding new idea:', ideaToAdd);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setNewIdea({ title: '', placeholder: '' });
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
              />
            </div>
            <Button
              onClick={() => setIsAddingNew(true)}
              disabled={isAddingNew}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage writing ideas that appear in the ideas banner. Total: {ideas.length} ideas
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add New Idea Form */}
          {isAddingNew && (
            <div className="border rounded-lg p-4 bg-muted/50">
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
                  <Button onClick={handleAddNew} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Ideas List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredIdeas.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                isEditing={editingId === idea.id}
                onEdit={() => handleEdit(idea.id)}
                onSave={(updatedIdea) => handleSave(idea.id, updatedIdea)}
                onDelete={() => handleDelete(idea.id)}
                onCancel={handleCancel}
              />
            ))}
          </div>

          {filteredIdeas.length === 0 && searchTerm && (
            <div className="text-center py-8 text-muted-foreground">
              No ideas found matching "{searchTerm}"
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface IdeaRowProps {
  idea: EditingIdea;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (idea: WritingIdea) => void;
  onDelete: () => void;
  onCancel: () => void;
}

function IdeaRow({ idea, isEditing, onEdit, onSave, onDelete, onCancel }: IdeaRowProps) {
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
      <div className="border rounded-lg p-4 bg-muted/50">
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
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
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
        <div className="flex gap-1 ml-4">
          <Button onClick={onEdit} variant="ghost" size="sm">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button onClick={onDelete} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
