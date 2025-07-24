"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { UsernameBadge } from '../ui/UsernameBadge';
import { X, Link as LinkIcon, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LinkSuggestion } from '../../services/linkSuggestionService';

interface LinkSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: LinkSuggestion[];
  matchedText: string;
  onSelectPage: (suggestion: LinkSuggestion) => void;
  onDismiss: () => void;
}

export function LinkSuggestionModal({
  isOpen,
  onClose,
  suggestions,
  matchedText,
  onSelectPage,
  onDismiss
}: LinkSuggestionModalProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<LinkSuggestion | null>(null);

  const handleSelectPage = (suggestion: LinkSuggestion) => {
    setSelectedSuggestion(suggestion);
    onSelectPage(suggestion);
    onClose();
  };

  const handleDismiss = () => {
    onDismiss();
    onClose();
  };

  // Group suggestions by title to handle multiple pages with same title
  const groupedSuggestions = suggestions.reduce((groups, suggestion) => {
    const title = suggestion.title;
    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(suggestion);
    return groups;
  }, {} as Record<string, LinkSuggestion[]>);

  const getMatchTypeIcon = (matchType: LinkSuggestion['matchType']) => {
    switch (matchType) {
      case 'exact':
        return <LinkIcon className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <LinkIcon className="h-4 w-4 text-blue-500" />;
      case 'keyword':
        return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'content':
        return <ExternalLink className="h-4 w-4 text-orange-500" />;
      default:
        return <LinkIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMatchTypeLabel = (matchType: LinkSuggestion['matchType']) => {
    switch (matchType) {
      case 'exact':
        return 'Exact match';
      case 'partial':
        return 'Partial match';
      case 'keyword':
        return 'Keyword match';
      case 'content':
        return 'Content match';
      default:
        return 'Match';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-blue-600 dark:text-blue-400';
    if (confidence >= 0.4) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="relative flex-shrink-0">
          <DialogTitle className="text-lg font-semibold pr-8 flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Link Suggestions for "{matchedText}"
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Explanation */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              We found pages that might be related to "<strong>{matchedText}</strong>". 
              Choose a page to create a link, or dismiss this suggestion.
            </p>
          </div>

          {/* Suggestions grouped by title */}
          <div className="space-y-4">
            {Object.entries(groupedSuggestions).map(([title, titleSuggestions]) => (
              <div key={title} className="border border-border rounded-lg overflow-hidden">
                {/* Title header */}
                <div className="bg-muted/50 px-4 py-2 border-b border-border">
                  <h3 className="font-medium text-foreground">{title}</h3>
                  {titleSuggestions.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {titleSuggestions.length} pages with this title
                    </p>
                  )}
                </div>

                {/* Pages with this title */}
                <div className="divide-y divide-border">
                  {titleSuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.id}-${index}`}
                      className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleSelectPage(suggestion)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Author info */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-muted-foreground">by</span>
                            <UsernameBadge
                              userId={suggestion.userId}
                              username={suggestion.username}
                              size="sm"
                              showBadge={true}
                            />
                          </div>

                          {/* Match info */}
                          <div className="flex items-center gap-2 mb-1">
                            {getMatchTypeIcon(suggestion.matchType)}
                            <span className="text-xs text-muted-foreground">
                              {getMatchTypeLabel(suggestion.matchType)}
                            </span>
                            <span className={cn(
                              "text-xs font-medium",
                              getConfidenceColor(suggestion.confidence)
                            )}>
                              {Math.round(suggestion.confidence * 100)}% match
                            </span>
                          </div>

                          {/* Last modified */}
                          <div className="text-xs text-muted-foreground">
                            Last modified: {new Date(suggestion.lastModified).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Select button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPage(suggestion);
                          }}
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          Link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* No suggestions message */}
          {suggestions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <LinkIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No matching pages found for "{matchedText}"</p>
              <p className="text-sm mt-1">Try selecting different text to link.</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {suggestions.length > 0 && (
              <>Found {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}</>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
            >
              Dismiss Suggestion
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
