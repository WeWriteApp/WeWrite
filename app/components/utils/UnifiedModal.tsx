/**
 * Unified Modal Component - Consolidates all modal types
 * 
 * Replaces:
 * - AlertModal.tsx
 * - ConfirmationModal.tsx  
 * - PromptModal.tsx
 * - ActionModal.tsx (if exists)
 * 
 * Provides:
 * - Single modal component with variant support
 * - Consistent styling and behavior
 * - All modal types in one place
 * - Simple, maintainable interface
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  X, 
  Check, 
  Trash2, 
  LogOut 
} from 'lucide-react';

type ModalVariant = 'alert' | 'confirm' | 'prompt' | 'action';
type ModalType = 'success' | 'error' | 'warning' | 'info' | 'default' | 'destructive';
type IconType = 'success' | 'error' | 'warning' | 'info' | 'delete' | 'logout' | 'check' | null;

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant: ModalVariant;
  type?: ModalType;
  icon?: IconType;
  isLoading?: boolean;
}

interface AlertModalProps extends BaseModalProps {
  variant: 'alert';
  buttonText?: string;
}

interface ConfirmModalProps extends BaseModalProps {
  variant: 'confirm';
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface PromptModalProps extends BaseModalProps {
  variant: 'prompt';
  onConfirm: (value: string) => void;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'password' | 'email';
}

interface ActionModalProps extends BaseModalProps {
  variant: 'action';
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline';
    icon?: React.ReactNode;
  }>;
}

type UnifiedModalProps = AlertModalProps | ConfirmModalProps | PromptModalProps | ActionModalProps;

/**
 * Unified Modal Component
 * 
 * Handles all modal types with a single, consistent interface.
 * Automatically determines layout and behavior based on variant.
 */
export function UnifiedModal(props: UnifiedModalProps) {
  const [inputValue, setInputValue] = useState('');

  // Reset input value when modal opens (for prompt variant)
  useEffect(() => {
    if (props.isOpen && props.variant === 'prompt') {
      setInputValue(props.defaultValue || '');
    }
  }, [props.isOpen, props.variant, 'defaultValue' in props ? props.defaultValue : '']);

  const getIcon = () => {
    const iconType = props.icon;
    switch (iconType) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
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

  const getIconBackground = () => {
    const type = props.type || 'default';
    switch (type) {
      case 'error':
      case 'destructive':
        return 'bg-red-100 dark:bg-red-900/30';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-900/30';
      case 'success':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'info':
      default:
        return 'bg-blue-100 dark:bg-blue-900/30';
    }
  };

  const getButtonVariant = (isConfirm: boolean = false) => {
    if (!isConfirm) return 'outline';
    
    const type = props.type || 'default';
    switch (type) {
      case 'destructive':
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const handleConfirm = () => {
    if (props.variant === 'confirm') {
      props.onConfirm();
      props.onClose();
    } else if (props.variant === 'prompt') {
      props.onConfirm(inputValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !props.isLoading) {
      if (props.variant === 'prompt' || props.variant === 'confirm') {
        handleConfirm();
      } else if (props.variant === 'alert') {
        props.onClose();
      }
    }
  };

  const renderContent = () => {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        {/* Icon */}
        {props.icon && (
          <div className={`p-3 rounded-full ${getIconBackground()}`}>
            {getIcon()}
          </div>
        )}

        {/* Title */}
        <h2 className="text-lg font-semibold text-center">
          {props.title}
        </h2>

        {/* Message */}
        <p className="text-sm text-muted-foreground text-center">
          {props.message}
        </p>

        {/* Input Field (for prompt variant) */}
        {props.variant === 'prompt' && (
          <div className="space-y-2 w-full">
            <Label htmlFor="unified-modal-input" className="sr-only">
              {props.title}
            </Label>
            <Input
              id="unified-modal-input"
              type={props.inputType || 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={props.placeholder || ''}
              disabled={props.isLoading}
              autoFocus
              className="w-full"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 w-full mt-4">
          {props.variant === 'alert' && (
            <Button
              variant={getButtonVariant(true)}
              onClick={props.onClose}
              className="min-w-[100px]"
            >
              <X className="h-4 w-4 mr-2" />
              {props.buttonText || 'OK'}
            </Button>
          )}

          {(props.variant === 'confirm' || props.variant === 'prompt') && (
            <>
              <Button
                variant="outline"
                onClick={props.onClose}
                disabled={props.isLoading}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                {props.cancelText || 'Cancel'}
              </Button>
              <Button
                variant={getButtonVariant(true)}
                onClick={handleConfirm}
                disabled={props.isLoading || (props.variant === 'prompt' && !inputValue.trim())}
                className="flex-1"
              >
                {props.isLoading ? (
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {props.isLoading ? 'Processing...' : (props.confirmText || 'Confirm')}
              </Button>
            </>
          )}

          {props.variant === 'action' && (
            <div className="flex flex-col gap-2 w-full">
              {props.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'default'}
                  onClick={() => {
                    action.onClick();
                    props.onClose();
                  }}
                  disabled={props.isLoading}
                  className="w-full"
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      className="sm:max-w-[425px]"
      showCloseButton={false}
    >
      {renderContent()}
    </Modal>
  );
}

// Convenience wrapper components for backward compatibility
export function AlertModal(props: Omit<AlertModalProps, 'variant'>) {
  return <UnifiedModal {...props} variant="alert" />;
}

export function ConfirmationModal(props: Omit<ConfirmModalProps, 'variant'>) {
  return <UnifiedModal {...props} variant="confirm" />;
}

export function PromptModal(props: Omit<PromptModalProps, 'variant'>) {
  return <UnifiedModal {...props} variant="prompt" />;
}

export function ActionModal(props: Omit<ActionModalProps, 'variant'>) {
  return <UnifiedModal {...props} variant="action" />;
}

export default UnifiedModal;
