"use client";

import React from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { AlertTriangle, CheckCircle, XCircle, Info, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  icon?: 'success' | 'error' | 'warning' | 'info' | null;
}

/**
 * AlertModal Component
 *
 * A unified alert modal that replaces all alert() calls
 * and provides consistent styling and behavior across the application.
 *
 * This component uses our custom Modal implementation to ensure
 * no duplicate modals appear and maintains proper z-index layering.
 */
export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = "OK",
  variant = 'info',
  icon = 'info'
}: AlertModalProps) {

  const getIcon = () => {
    switch (icon) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  const getButtonVariant = () => {
    switch (variant) {
      case 'error':
        return 'destructive';
      case 'success':
        return 'default';
      case 'warning':
        return 'default';
      default:
        return 'default';
    }
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
            variant === 'error'
              ? 'bg-red-100 dark:bg-red-900/30'
              : variant === 'warning'
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : variant === 'success'
              ? 'bg-green-100 dark:bg-green-900/30'
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

        {/* Action Button */}
        <div className="flex justify-center w-full mt-4">
          <Button
            variant={getButtonVariant()}
            onClick={onClose}
            className="min-w-[100px]"
          >
            <X className="h-4 w-4 mr-2" />
            {buttonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AlertModal;
