"use client";

import { Button } from "../components/ui/button";
import { useToast } from "../components/ui/use-toast";

export default function ToastTestPage() {
  const { toast } = useToast();

  const showDefaultToast = () => {
    toast({
      title: "Default Toast",
      description: "This is a default toast notification.",
    });
  };

  const showSuccessToast = () => {
    toast({
      title: "Success!",
      description: "This is a success toast notification.",
      variant: "success",
    });
  };

  const showErrorToast = () => {
    toast({
      title: "Error!",
      description: "This is an error toast notification.",
      variant: "destructive",
    });
  };

  const showInfoToast = () => {
    toast({
      title: "Information",
      description: "This is an info toast notification.",
      variant: "info",
    });
  };

  const showWarningToast = () => {
    toast({
      title: "Warning!",
      description: "This is a warning toast notification.",
      variant: "warning",
    });
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Toast Test Page</h1>
      <p className="mb-4">
        This page is used to test the toast notification system in both light and dark modes.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button onClick={showDefaultToast} variant="outline">
            Show Default Toast
          </Button>
          <Button onClick={showSuccessToast} variant="outline">
            Show Success Toast
          </Button>
          <Button onClick={showErrorToast} variant="outline">
            Show Error Toast
          </Button>
          <Button onClick={showInfoToast} variant="outline">
            Show Info Toast
          </Button>
          <Button onClick={showWarningToast} variant="outline">
            Show Warning Toast
          </Button>
        </div>
      </div>
    </div>
  );
}
