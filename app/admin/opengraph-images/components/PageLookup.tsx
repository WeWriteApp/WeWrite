import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';

interface PageLookupProps {
  lookupPageId: string;
  setLookupPageId: (id: string) => void;
  lookupPageData: any;
  isLookingUp: boolean;
  onLookup: () => void;
  onClear: () => void;
}

export function PageLookup({ lookupPageId, setLookupPageId, lookupPageData, isLookingUp, onLookup, onClear }: PageLookupProps) {
  return (
    <div className="wewrite-card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Search" size={20} className="text-muted-foreground" />
        <h3 className="text-lg font-semibold">Look Up a Specific Page</h3>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Enter page ID..."
          value={lookupPageId}
          onChange={(e) => setLookupPageId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onLookup()}
          className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button
          onClick={onLookup}
          disabled={!lookupPageId.trim() || isLookingUp}
          className="gap-2"
        >
          {isLookingUp ? (
            <>
              <Icon name="Loader" />
              Looking up...
            </>
          ) : (
            <>
              <Icon name="Search" size={16} />
              Look Up
            </>
          )}
        </Button>
        {lookupPageData && (
          <Button
            variant="outline"
            onClick={onClear}
            className="gap-1"
          >
            <Icon name="X" size={16} />
            Clear
          </Button>
        )}
      </div>

      {lookupPageData && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="font-medium text-sm">{lookupPageData.title}</div>
          <div className="text-xs text-muted-foreground">by {lookupPageData.authorUsername || lookupPageData.username}</div>
          <div className="text-xs text-muted-foreground mt-1">ID: {lookupPageData.id} &bull; Sponsors: {lookupPageData.sponsorCount || 0}</div>
        </div>
      )}
    </div>
  );
}
