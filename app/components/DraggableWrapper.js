"use client";

import React, { useState, useRef, useEffect } from 'react';

/**
 * A wrapper component that makes its children draggable
 * @param {Object} props
 * @param {React.ReactNode} props.children - The content to be made draggable
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.id - Unique identifier for the wrapper
 * @param {Object} props.initialPosition - Initial position {x, y}
 * @param {Function} props.onPositionChange - Callback when position changes
 * @param {string} props.zIndex - CSS z-index value
 */
const DraggableWrapper = ({
  children,
  className = '',
  id = 'draggable-wrapper',
  initialPosition = { x: 20, y: 20 },
  onPositionChange,
  zIndex = '9999',
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef(null);

  // Load saved position from localStorage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem(`draggable-position-${id}`);
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch (e) {
        console.error('Failed to parse saved position', e);
      }
    }
  }, [id]);

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`draggable-position-${id}`, JSON.stringify(position));
    if (onPositionChange) {
      onPositionChange(position);
    }
  }, [position, id, onPositionChange]);

  const handleMouseDown = (e) => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={wrapperRef}
      id={id}
      className={`fixed ${className} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: zIndex,
        userSelect: 'none',
      }}
    >
      <div 
        className="draggable-handle bg-background border border-border rounded-t-md px-2 py-1 flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="text-xs text-muted-foreground">Drag me</div>
        <button 
          className="text-xs text-muted-foreground hover:text-foreground ml-2"
          onClick={() => {
            setPosition(initialPosition);
          }}
        >
          Reset
        </button>
      </div>
      <div className="draggable-content border border-t-0 border-border rounded-b-md bg-background/95 backdrop-blur-sm shadow-md">
        {children}
      </div>
    </div>
  );
};

export default DraggableWrapper;
