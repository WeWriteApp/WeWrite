import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';

const ActionModal = ({
  isOpen,
  onClose,
  message,
  primaryActionLabel,
  primaryActionHref,
  secondaryActionLabel = "Maybe later",
  className = ""
}) => {
  const modalRef = useRef(null);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Add a more reliable click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Add the event listener with a slight delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black bg-opacity-50"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 500 }}
            className={`relative w-[90%] max-w-[320px] ${className}`}
          >
            <div className="bg-blue-500 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 text-white text-center text-base">
                {message}
              </div>

              <div className="flex border-t border-blue-400">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {secondaryActionLabel}
                </button>

                <a
                  href={primaryActionHref}
                  className="flex-1 py-3 px-4 text-center bg-white !text-black hover:bg-gray-100 transition-colors text-sm font-medium border-l border-blue-400"
                >
                  {primaryActionLabel}
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActionModal;