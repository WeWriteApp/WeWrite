"use client";

import { Button } from "./ui/button";
import { useToast } from "./ui/use-toast";

export function ToastTester() {
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-bold">Toast Tester</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          onClick={() => {
            toast({
              title: "Default Toast",
              description: "This is a default toast notification",
            });
          }}
        >
          Default Toast
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            toast.error("Error Toast", {
              description: "This is an error toast notification",
            });
          }}
        >
          Error Toast
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            toast.success("Success Toast", {
              description: "This is a success toast notification",
            });
          }}
        >
          Success Toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            toast.info("Info Toast", {
              description: "This is an info toast notification",
            });
          }}
        >
          Info Toast
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            toast.warning("Warning Toast", {
              description: "This is a warning toast notification",
            });
          }}
        >
          Warning Toast
        </Button>
      </div>
    </div>
  );
}
