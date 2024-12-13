"use client";
import { useRef, useEffect } from "react";
import { LinkDropdownPlugin } from './LinkDropdownPlugin';

function BracketComponent({ showDropdown = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        containerRef.current.style.display = 'none';
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef]);

  if (!showDropdown) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <LinkDropdownPlugin />
    </div>
  );
}

export default BracketComponent;
