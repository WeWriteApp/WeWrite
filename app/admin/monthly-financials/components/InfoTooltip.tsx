import React, { useState, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';

export function InfoTooltip({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex ml-1 align-middle cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Icon name="HelpCircle" size={24} className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      {isVisible && (
        <div
          className="fixed z-[9999] px-3 py-2 bg-[var(--card-bg)] text-foreground text-xs rounded-lg shadow-lg border whitespace-normal w-64 pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}
