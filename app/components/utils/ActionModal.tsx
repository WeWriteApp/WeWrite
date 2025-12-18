import React from 'react';
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel?: string;
  className?: string;
}

const ActionModal: React.FC<ActionModalProps> = ({
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
      <div className="bg-muted/500 rounded-xl overflow-hidden shadow-2xl -m-6">
        <div className="px-6 py-4 text-white text-center text-base">
          {message}
        </div>

        <div className="flex border-t border-border">
          <Button
            onClick={onClose}
            className="flex-1 py-3 px-4 text-center bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium rounded-none border-0"
          >
            {secondaryActionLabel}
          </Button>

          <a
            href={primaryActionHref}
            className="flex-1 py-3 px-4 text-center bg-white !text-black hover:bg-gray-100 transition-colors text-sm font-medium border-l border-border no-underline"
          >
            {primaryActionLabel}
          </a>
        </div>
      </div>
    </Modal>
  );
};

export default ActionModal;
