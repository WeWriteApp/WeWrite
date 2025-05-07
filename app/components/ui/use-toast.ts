import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  [key: string]: any
}

export const toast = {
  // Basic toast methods that map directly to Sonner
  success: (message: string, options?: any) => sonnerToast.success(message, options),
  error: (message: string, options?: any) => sonnerToast.error(message, options),
  info: (message: string, options?: any) => sonnerToast.info(message, options),
  warning: (message: string, options?: any) => sonnerToast.warning(message, options),
  
  // Custom method to maintain compatibility with shadcn/ui toast API
  custom: ({ title, description, variant, ...props }: ToastProps) => {
    switch (variant) {
      case "destructive":
        return sonnerToast.error(title, { description, ...props });
      case "success":
        return sonnerToast.success(title, { description, ...props });
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
  
  // For compatibility with the shadcn/ui API
  promise: sonnerToast.promise
};

// Provide a compatible API with the shadcn/ui implementation
export function useToast() {
  return {
    toast,
    dismiss: toast.dismiss,
    toasts: [] // Empty array for compatibility
  };
}
