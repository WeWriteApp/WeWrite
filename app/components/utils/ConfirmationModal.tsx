"use client";

import React from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  isLoading?: boolean;
  icon?: 'warning' | 'delete' | 'logout' | 'check' | null;
}

/**
 * ConfirmationModal Component
 *
 * A unified confirmation modal that replaces all window.confirm() calls
 * and provides consistent styling and behavior across the application.
 *
 * This component uses our custom Modal implementation to ensure
 * no duplicate modals appear and maintains proper z-index layering.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'default',
  isLoading = false,
  icon = 'warning'
}: ConfirmationModalProps) {

  const getIcon = () => {
    switch (icon) {
      case 'warning':
        return <Icon name="Warning" size={24} className="text-amber-600 dark:text-amber-400" />;
      case 'delete':
        return <Icon name="Trash" size={24} className="text-red-600 dark:text-red-400" />;
      case 'logout':
        return <Icon name="User" size={24} className="text-primary dark:text-muted-foreground" />;
      case 'check':
        return <Icon name="Check" size={24} className="text-green-600 dark:text-green-400" />;
      default:
        return null;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      default:
        return '';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="sm:max-w-[425px]"
      showCloseButton={false}
    >
      <div className="flex flex-col items-center gap-4 p-6">
        {/* Icon */}
        {icon && (
          <div className={`p-3 rounded-full ${
            variant === 'destructive'
              ? 'bg-red-100 dark:bg-red-900/30'
              : variant === 'warning'
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-muted dark:bg-muted/30'
          }`}>
            {getIcon()}
          </div>
        )}

        {/* Title */}
        <h2 className="text-lg font-semibold text-center">
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm text-muted-foreground text-center">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 w-full mt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            <Icon name="Close" size={16} className="mr-2" />
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 ${getConfirmButtonClass()}`}
          >
            {isLoading ? (
              <Icon name="Loader" size={16} className="mr-2" />
            ) : (
              getIcon() && <span className="h-4 w-4 mr-2">{getIcon()}</span>
            )}
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmationModal;