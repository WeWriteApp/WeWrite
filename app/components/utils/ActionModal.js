import React from 'react';
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";

const ActionModal = ({
  isOpen,
  onClose,
  message,
  primaryActionLabel,
  primaryActionHref,
  secondaryActionLabel = "Maybe later",
  className = ""
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={`sm:max-w-[320px] ${className}`}
      showCloseButton={false}
    >
      <div className="bg-blue-500 rounded-xl overflow-hidden shadow-2xl -m-6">
        <div className="px-6 py-4 text-white text-center text-base">
          {message}
        </div>

        <div className="flex border-t border-blue-400">
          <Button
            onClick={onClose}
            className="flex-1 py-3 px-4 text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium rounded-none border-0"
          >
            {secondaryActionLabel}
          </Button>

          <a
            href={primaryActionHref}
            className="flex-1 py-3 px-4 text-center bg-white !text-black hover:bg-gray-100 transition-colors text-sm font-medium border-l border-blue-400 no-underline"
          >
            {primaryActionLabel}
          </a>
        </div>
      </div>
    </Modal>
  );
};

export default ActionModal;