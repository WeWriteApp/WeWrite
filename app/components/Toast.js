import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Toast = ({ message, link, onClose, duration = 3000 }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!mounted) return null;

  // Only create portal if we're in the browser
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed bottom-4 right-4 z-50 animate-fade-in"
      style={{
        animation: 'fadeIn 0.3s ease-in-out',
      }}
    >
      <div className="bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <span>{message}</span>
        {link && (
          <a 
            href={link.href} 
            className="text-blue-300 hover:text-blue-200 underline"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {link.text}
          </a>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-2 text-gray-300 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
};

export default Toast; 