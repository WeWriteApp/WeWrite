"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, Check } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'password' | 'email';
  isLoading?: boolean;
}

/**
 * PromptModal Component
 *
 * A unified prompt modal that replaces all prompt() calls
 * and provides consistent styling and behavior across the application.
 *
 * This component uses our custom Modal implementation to ensure
 * no duplicate modals appear and maintains proper z-index layering.
 */
export function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder = "",
  defaultValue = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  inputType = 'text',
  isLoading = false
}: PromptModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  // Reset input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  const handleConfirm = () => {
    onConfirm(inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleConfirm();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="sm:max-w-[425px]"
      showCloseButton={false}
    >
      <div className="flex flex-col gap-4 p-6">
        {/* Title */}
        <h2 className="text-lg font-semibold text-center">
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm text-muted-foreground text-center">
          {message}
        </p>

        {/* Input Field */}
        <div className="space-y-2">
          <Label htmlFor="prompt-input" className="sr-only">
            {title}
          </Label>
          <Input
            id="prompt-input"
            type={inputType}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            autoFocus
            className="w-full"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 w-full mt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            {cancelText}
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isLoading || !inputValue.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default PromptModal;