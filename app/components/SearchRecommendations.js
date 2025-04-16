"use client";

import React from 'react';
import { PillLink } from './PillLink';

/**
 * SearchRecommendations Component
 * 
 * Displays search recommendations as clickable pills
 * 
 * @param {Object} props
 * @param {Function} props.onSelect - Function to call when a recommendation is selected
 */
export default function SearchRecommendations({ onSelect }) {
  const recommendations = [
    { id: 'interesting', label: 'Interesting pages' },
    { id: 'books', label: 'Book lists' },
    { id: 'travel', label: 'Travel' },
    { id: 'places', label: 'Places' },
    { id: 'research', label: 'Research' }
  ];

  const handleClick = (recommendation) => {
    if (onSelect) {
      onSelect(recommendation.label);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Try searching for:</h3>
      <div className="flex flex-wrap gap-2">
        {recommendations.map((recommendation) => (
          <button
            key={recommendation.id}
            onClick={() => handleClick(recommendation)}
            className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-sm transition-colors"
          >
            {recommendation.label}
          </button>
        ))}
      </div>
    </div>
  );
}
