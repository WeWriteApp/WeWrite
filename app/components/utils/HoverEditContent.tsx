"use client";

import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import TextView from '../editor/TextView';

interface HoverEditContentProps {
  content: any;
  canEdit: boolean;
  setIsEditing: (editing: boolean, position?: { x: number; y: number; clientX: number; clientY: number } | null) => void;
  showLineNumbers?: boolean;
  className?: string;
}

/**
 * HoverEditContent Component
 * 
 * Implements hover-reveal edit functionality similar to regular wiki pages.
 * Shows edit icon on hover over content area for users with edit permissions.
 * Maintains click-to-edit functionality while adding visual edit indicators.
 */
const HoverEditContent: React.FC<HoverEditContentProps> = ({
  content,
  canEdit,
  setIsEditing,
  showLineNumbers = false,
  className = ""
}) => {
  const [isHovering, setIsHovering] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Capture click position for cursor positioning
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY
    };
    
    setIsEditing(true, clickPosition);
  };

  return (
    <div
      className={`group relative ${className}`}
      onMouseEnter={() => canEdit && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Content area with hover effects - unified structure with edit mode */}
      <div className={`relative ${canEdit ? 'cursor-text hover:bg-muted/20 transition-colors duration-150' : ''}`}>
        <TextView
          content={content}
          canEdit={canEdit}
          setIsEditing={setIsEditing}
          showLineNumbers={showLineNumbers}
        />

        {/* Hover-reveal edit icon - positioned similar to regular wiki pages */}
        {canEdit && isHovering && (
          <div className="absolute top-2 right-2 z-10">
            <Edit2
              className="h-4 w-4 text-muted-foreground cursor-pointer transition-opacity duration-200 opacity-60 hover:opacity-100 bg-background/80 rounded p-0.5 shadow-sm"
              onClick={handleEditClick}
              title="Click to edit"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HoverEditContent;