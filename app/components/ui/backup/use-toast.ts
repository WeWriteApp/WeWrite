// Inspired by react-hot-toast library
import * as React from "react"
import { toast as sonnerToast } from "sonner"

// Re-export the toast function from Sonner with a compatible API
export const toast = {
  // Basic toast methods that map directly to Sonner
  success: (message: string, options?: any) => sonnerToast.success(message, options),
  error: (message: string, options?: any) => sonnerToast.error(message, options),
  info: (message: string, options?: any) => sonnerToast.info(message, options),
  warning: (message: string, options?: any) => sonnerToast.warning(message, options),
  
  // Custom method to maintain compatibility with the old API
  custom: ({ title, description, variant, ...props }: any) => {
    switch (variant) {
      case "destructive":
        return sonnerToast.error(title, { description, ...props });
      case "success":
        return sonnerToast.success(title, { description, ...props });
      case "info":
        return sonnerToast.info(title, { description, ...props });
      default:
        return sonnerToast(title, { description, ...props });
    }
  },
  
  // Default method to show a standard toast
  default: (message: string, options?: any) => sonnerToast(message, options),
  
  // Dismiss method for compatibility
  dismiss: (toastId?: string) => {
    if (toastId) {
      sonnerToast.dismiss(toastId);
    } else {
      sonnerToast.dismiss();
    }
  },
  
  // For compatibility with the old API
  promise: sonnerToast.promise
};

// Provide a compatible API with the previous implementation
export function useToast() {
  return {
    toast,
    dismiss: toast.dismiss,
    toasts: [] // Empty array for compatibility
  };
}
