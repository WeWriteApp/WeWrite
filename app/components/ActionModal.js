import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

const ActionModal = ({ 
  isOpen, 
  onClose, 
  message, 
  primaryActionLabel, 
  primaryActionHref,
  secondaryActionLabel = "Maybe later",
  className = ""
}) => {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 500 }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-auto ${className}`}
          >
            <div className="bg-blue-500 rounded-lg overflow-hidden shadow-xl">
              <div className="p-6 text-white text-center text-lg">
                {message}
              </div>
              
              <div className="flex">
                <button
                  onClick={onClose}
                  className="flex-1 p-4 text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {secondaryActionLabel}
                </button>
                
                <a
                  href={primaryActionHref}
                  className="flex-1 p-4 text-center bg-white text-black hover:bg-gray-100 transition-colors"
                >
                  {primaryActionLabel}
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ActionModal; 