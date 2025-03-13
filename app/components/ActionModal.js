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
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 500 }}
            className={`fixed left-1/2 bottom-4 transform -translate-x-1/2 z-50 ${className}`}
          >
            <div className="bg-blue-500 rounded-lg overflow-hidden shadow-xl w-full max-w-md">
              <div className="p-4 text-white text-center">
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
                  className="flex-1 p-4 text-center bg-white text-gray-900 hover:bg-gray-100 transition-colors"
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