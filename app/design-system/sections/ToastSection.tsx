"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/use-toast';
import { ComponentShowcase, StateDemo } from './shared';

export function ToastSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Toast"
      path="@/components/ui/use-toast (powered by Sonner)"
      description="Toast notifications for transient feedback. Toasts appear at the bottom-right and auto-dismiss. Use for confirmations, errors, and status updates."
    >
      <StateDemo label="All Variants">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => toast("Default Toast", { description: "This is a default toast message." })}
          >
            <Icon name="Bell" size={16} className="mr-2" />
            Default
          </Button>

          <Button
            variant="outline"
            onClick={() => toast.success("Success!", { description: "Your action was completed successfully." })}
          >
            <Icon name="CheckCircle" size={16} className="mr-2 text-green-500" />
            Success
          </Button>

          <Button
            variant="outline"
            onClick={() => toast.error("Error occurred", { description: "Something went wrong. Please try again." })}
          >
            <Icon name="XCircle" size={16} className="mr-2 text-red-500" />
            Error
          </Button>

          <Button
            variant="outline"
            onClick={() => toast.info("Information", { description: "Here's some helpful information." })}
          >
            <Icon name="Info" size={16} className="mr-2 text-blue-500" />
            Info
          </Button>

          <Button
            variant="outline"
            onClick={() => toast.warning("Warning", { description: "Please be aware of this important notice." })}
          >
            <Icon name="AlertTriangle" size={16} className="mr-2 text-yellow-500" />
            Warning
          </Button>
        </div>
      </StateDemo>

      <StateDemo label="Error with Copy Button">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            onClick={() => toast.error("Payment Failed", {
              description: "Card declined: Insufficient funds",
              enableCopy: true,
              copyText: "Payment Failed: Card declined - Insufficient funds. Error code: PAY_001"
            })}
          >
            <Icon name="CreditCard" size={16} className="mr-2" />
            Error with Copy
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Error toasts can include a copy button for debugging info.
        </p>
      </StateDemo>

      <StateDemo label="Title Only">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => toast.success("Copied to clipboard")}
          >
            <Icon name="Copy" size={16} className="mr-2" />
            Quick Success
          </Button>

          <Button
            variant="outline"
            onClick={() => toast.error("Failed to save")}
          >
            <Icon name="X" size={16} className="mr-2" />
            Quick Error
          </Button>
        </div>
      </StateDemo>

      <StateDemo label="With Actions">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => toast("File deleted", {
              description: "document.pdf was moved to trash",
              action: {
                label: "Undo",
                onClick: () => toast.success("File restored!")
              }
            })}
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            With Undo Action
          </Button>

          <Button
            variant="outline"
            onClick={() => toast.loading("Uploading file...")}
          >
            <Icon name="Upload" size={16} className="mr-2" />
            Loading Toast
          </Button>
        </div>
      </StateDemo>

      <StateDemo label="Promise Toast">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              const promise = new Promise((resolve) => setTimeout(resolve, 2000));
              toast.promise(promise, {
                loading: "Saving changes...",
                success: "Changes saved!",
                error: "Failed to save"
              });
            }}
          >
            <Icon name="Save" size={16} className="mr-2" />
            Promise Toast
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Shows loading state, then success/error based on promise result.
        </p>
      </StateDemo>

      <StateDemo label="Usage">
        <div className="w-full space-y-4">
          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Import</p>
            <pre className="text-xs overflow-x-auto">
{`import { toast } from '@/components/ui/use-toast';`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Basic Usage</p>
            <pre className="text-xs overflow-x-auto">
{`// Helper methods (recommended)
toast.success("Success message");
toast.error("Error message");
toast.info("Info message");
toast.warning("Warning message");
toast.loading("Loading...");

// With description
toast.success("Saved", { description: "Your changes have been saved." });

// Error with copy button (for debugging)
toast.error("Payment failed", {
  description: "Card declined",
  enableCopy: true,
  copyText: "Full error details for debugging"
});

// With action button
toast("File deleted", {
  action: {
    label: "Undo",
    onClick: () => console.log("Undo clicked")
  }
});

// Promise-based (loading -> success/error)
toast.promise(fetchData(), {
  loading: "Loading...",
  success: "Data loaded!",
  error: "Failed to load"
});`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Dismiss Programmatically</p>
            <pre className="text-xs overflow-x-auto">
{`const toastId = toast.loading("Processing...");

// Later...
toast.dismiss(toastId); // Dismiss specific toast

// Or dismiss all
toast.dismiss();`}
            </pre>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Toast vs Alert Guidelines">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div className="wewrite-card p-4 border-l-4 border-l-green-500">
            <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">Use Toast For:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Brief confirmations ("Saved", "Copied")</li>
              <li>Background operation results</li>
              <li>Non-blocking notifications</li>
              <li>Transient status updates</li>
            </ul>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-amber-500">
            <h4 className="font-semibold mb-2 text-amber-600 dark:text-amber-400">Use Alert For:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Persistent warnings on page</li>
              <li>Form validation errors</li>
              <li>Important notices that need attention</li>
              <li>Contextual information within content</li>
            </ul>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
