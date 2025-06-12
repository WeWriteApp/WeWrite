"use client";

import React from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { AlertTriangle, Trash2, LogOut, X, Check } from 'lucide-react';

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
        return <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
      case 'delete':
        return <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />;
      case 'logout':
        return <LogOut className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
      case 'check':
        return <Check className="h-6 w-6 text-green-600 dark:text-green-400" />;
      default:
        return null;
    }
  };

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case 'destructive':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'default';
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
              : 'bg-blue-100 dark:bg-blue-900/30'
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
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            {cancelText}
          </Button>
          <Button
            variant={getConfirmButtonVariant()}
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
