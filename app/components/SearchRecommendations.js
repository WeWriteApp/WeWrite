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
  // Single list of search suggestions
  const recommendations = [
    { id: 'interesting', label: 'Interesting pages' },
    { id: 'books', label: 'Book lists' },
    { id: 'travel', label: 'Travel guides' },
    { id: 'places', label: 'Places to visit' },
    { id: 'research', label: 'Research' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'technology', label: 'Technology' },
    { id: 'science', label: 'Science' },
    { id: 'how-to', label: 'How-to guides' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'tutorials', label: 'Tutorials' },
    { id: 'collections', label: 'Collections' },
    { id: 'resources', label: 'Resources' },
    { id: 'stories', label: 'Stories' },
    { id: 'lists', label: 'Lists' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'art', label: 'Art & Design' },
    { id: 'music', label: 'Music' },
    { id: 'movies', label: 'Movies & TV' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'fitness', label: 'Fitness & Health' },
    { id: 'cooking', label: 'Cooking' },
    { id: 'gardening', label: 'Gardening' },
    { id: 'photography', label: 'Photography' },
    { id: 'writing', label: 'Writing' },
    { id: 'history', label: 'History' },
    { id: 'philosophy', label: 'Philosophy' },
    { id: 'psychology', label: 'Psychology' },
    { id: 'education', label: 'Education' },
    { id: 'languages', label: 'Languages' },
    { id: 'mathematics', label: 'Mathematics' },
    { id: 'sustainability', label: 'Sustainability' },
    { id: 'minimalism', label: 'Minimalism' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'self-improvement', label: 'Self-improvement' },
    { id: 'mental-health', label: 'Mental health' },
    { id: 'finance', label: 'Personal finance' }
  ];

  const handleClick = (recommendation) => {
    if (onSelect) {
      onSelect(recommendation.label);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Try searching for:</h3>

      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {recommendations.map((recommendation) => (
          <button
            key={recommendation.id}
            onClick={() => handleClick(recommendation)}
            className="flex-none bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full text-sm transition-all hover:scale-105 hover:shadow-sm whitespace-nowrap"
          >
            {recommendation.label}
          </button>
        ))}
      </div>
    </div>
  );
}
