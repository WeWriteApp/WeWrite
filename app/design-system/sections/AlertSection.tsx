"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { ConfirmationModal, AlertModal, PromptModal } from '../../components/utils/UnifiedModal';
import { useConfirmation } from '../../hooks/useConfirmation';
import { ComponentShowcase, StateDemo } from './shared';

export function AlertSection({ id }: { id: string }) {
  // Demo states for modals
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptResult, setPromptResult] = useState<string | null>(null);

  // Confirmation hook demo
  const { confirmationState, confirm, closeConfirmation, confirmDelete } = useConfirmation();
  const [hookResult, setHookResult] = useState<string | null>(null);

  const handleConfirmDemo = async () => {
    const confirmed = await confirm({
      title: "Confirm Action",
      message: "Are you sure you want to proceed with this action?",
      confirmText: "Yes, Proceed",
      cancelText: "Cancel",
      variant: "default"
    });
    setHookResult(confirmed ? "Confirmed!" : "Cancelled");
    setTimeout(() => setHookResult(null), 2000);
  };

  const handleDeleteDemo = async () => {
    const confirmed = await confirmDelete("this item");
    setHookResult(confirmed ? "Deleted!" : "Cancelled");
    setTimeout(() => setHookResult(null), 2000);
  };

  return (
    <ComponentShowcase
      id={id}
      title="Alert & Confirmation System"
      path="@/components/ui/alert, @/components/utils/UnifiedModal, @/hooks/useConfirmation"
      description="Complete system for user feedback: inline alerts for status messages and confirmation modals to replace window.confirm(). Always use custom modals instead of browser alerts."
    >
      <StateDemo label="All Variants">
        <div className="w-full space-y-3">
          <Alert>
            <Icon name="Info" size={16} />
            <AlertDescription>
              Default alert for general information messages.
            </AlertDescription>
          </Alert>

          <Alert variant="info">
            <Icon name="Info" size={16} />
            <AlertDescription>
              Info alert for helpful tips and guidance.
            </AlertDescription>
          </Alert>

          <Alert variant="success">
            <Icon name="CheckCircle" size={16} />
            <AlertDescription>
              Success alert for confirmations and completed actions.
            </AlertDescription>
          </Alert>

          <Alert variant="warning">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription>
              Warning alert for important notices that need attention.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription>
              Destructive alert for errors and critical issues.
            </AlertDescription>
          </Alert>
        </div>
      </StateDemo>

      <StateDemo label="With Title">
        <div className="w-full space-y-3">
          <Alert variant="warning">
            <Icon name="AlertCircle" size={16} />
            <AlertTitle>Subscription Inactive</AlertTitle>
            <AlertDescription>
              Your subscription is currently inactive. Reactivate to continue using premium features.
            </AlertDescription>
          </Alert>
        </div>
      </StateDemo>

      <StateDemo label="With Action Button">
        <div className="w-full">
          <Alert variant="warning">
            <Icon name="AlertCircle" size={16} />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
              <span>Your subscription is currently inactive.</span>
              <Button variant="default" size="sm" className="shrink-0 w-full sm:w-auto">
                Reactivate Subscription
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </StateDemo>

      {/* Confirmation Modals Section */}
      <StateDemo label="Confirmation Modals (Replaces window.confirm)">
        <div className="w-full space-y-4">
          <div className="wewrite-card p-4 border-l-4 border-l-red-500 bg-red-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="AlertTriangle" size={16} className="text-red-500" />
              <h4 className="font-semibold text-red-700 dark:text-red-400">Important: Never Use window.confirm()</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Always use <code className="bg-muted px-1 py-0.5 rounded text-xs">useConfirmation</code> hook + <code className="bg-muted px-1 py-0.5 rounded text-xs">ConfirmationModal</code> instead of browser&apos;s <code className="bg-muted px-1 py-0.5 rounded text-xs">window.confirm()</code>. This ensures consistent styling and UX across the app.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleConfirmDemo}>
              <Icon name="Check" size={16} className="mr-2" />
              Show Confirmation
            </Button>
            <Button variant="destructive" onClick={handleDeleteDemo}>
              <Icon name="Trash" size={16} className="mr-2" />
              Show Delete Confirmation
            </Button>
            <Button variant="outline" onClick={() => setShowAlertModal(true)}>
              <Icon name="Info" size={16} className="mr-2" />
              Show Alert Modal
            </Button>
            <Button variant="outline" onClick={() => setShowPromptModal(true)}>
              <Icon name="Edit" size={16} className="mr-2" />
              Show Prompt Modal
            </Button>
          </div>

          {hookResult && (
            <div className="text-sm font-medium text-green-600 dark:text-green-400 animate-pulse">
              Result: {hookResult}
            </div>
          )}

          {promptResult && (
            <div className="text-sm text-muted-foreground">
              Prompt result: &quot;{promptResult}&quot;
            </div>
          )}
        </div>
      </StateDemo>

      <StateDemo label="useConfirmation Hook Usage">
        <div className="w-full space-y-4">
          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Step 1: Import and Initialize</p>
            <pre className="text-xs overflow-x-auto">
{`import { useConfirmation } from '@/hooks/useConfirmation';
import { ConfirmationModal } from '@/components/utils/UnifiedModal';

// In your component:
const { confirmationState, confirm, closeConfirmation } = useConfirmation();`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Step 2: Use confirm() (returns Promise&lt;boolean&gt;)</p>
            <pre className="text-xs overflow-x-auto">
{`// Generic confirmation
const handleDelete = async () => {
  const confirmed = await confirm({
    title: "Delete Page?",
    message: "Are you sure you want to delete this page?",
    confirmText: "Delete",
    cancelText: "Cancel",
    variant: "destructive"  // or "warning" | "default"
  });

  if (confirmed) {
    // User clicked confirm
    await deletePage();
  }
};

// Convenience methods available:
const confirmed = await confirmDelete("this item");
const confirmed = await confirmLogout();
const confirmed = await confirmCancelSubscription();`}
            </pre>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Step 3: Render the Modal</p>
            <pre className="text-xs overflow-x-auto">
{`// In your JSX (typically near the end of the component):
<ConfirmationModal
  isOpen={confirmationState.isOpen}
  onClose={closeConfirmation}
  onConfirm={confirmationState.onConfirm}
  title={confirmationState.title}
  message={confirmationState.message}
  confirmText={confirmationState.confirmText}
  cancelText={confirmationState.cancelText}
  type={confirmationState.variant}
/>`}
            </pre>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Modal Variants">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <div className="wewrite-card p-4 border-l-4 border-l-blue-500">
            <h4 className="font-semibold mb-2">ConfirmationModal</h4>
            <p className="text-xs text-muted-foreground mb-2">Yes/No decisions</p>
            <code className="text-xs text-muted-foreground">variant=&quot;confirm&quot;</code>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-amber-500">
            <h4 className="font-semibold mb-2">AlertModal</h4>
            <p className="text-xs text-muted-foreground mb-2">Info with OK button</p>
            <code className="text-xs text-muted-foreground">variant=&quot;alert&quot;</code>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-green-500">
            <h4 className="font-semibold mb-2">PromptModal</h4>
            <p className="text-xs text-muted-foreground mb-2">Text input required</p>
            <code className="text-xs text-muted-foreground">variant=&quot;prompt&quot;</code>
          </div>
          <div className="wewrite-card p-4 border-l-4 border-l-purple-500">
            <h4 className="font-semibold mb-2">ActionModal</h4>
            <p className="text-xs text-muted-foreground mb-2">Multiple action buttons</p>
            <code className="text-xs text-muted-foreground">variant=&quot;action&quot;</code>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="Modal Patterns: Dialog vs Adaptive">
        <div className="w-full space-y-4">
          <div className="wewrite-card p-4 border-l-4 border-l-blue-500 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Info" size={16} className="text-blue-500" />
              <h4 className="font-semibold text-blue-700 dark:text-blue-400">Key Pattern: Centered Dialogs for Alerts</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              All alert/confirmation modals (ConfirmationModal, AlertModal, PromptModal, ActionModal) are <strong>always centered</strong> on screen, on both mobile and desktop. They never appear as bottom drawers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="wewrite-card p-4">
              <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">Use Centered Dialog For:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Confirmations (delete, cancel, logout)</li>
                <li>Alerts (success, error, warning)</li>
                <li>Simple prompts (single input)</li>
                <li>Quick actions (2-4 buttons)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Use: <code className="bg-muted px-1 rounded">UnifiedModal</code> components
              </p>
            </div>
            <div className="wewrite-card p-4">
              <h4 className="font-semibold mb-2 text-amber-600 dark:text-amber-400">Use Adaptive Modal For:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Complex forms with many fields</li>
                <li>Settings panels</li>
                <li>Content selection (lists, grids)</li>
                <li>Multi-step workflows</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Use: <code className="bg-muted px-1 rounded">Modal</code> or <code className="bg-muted px-1 rounded">AdaptiveModal</code>
              </p>
            </div>
          </div>

          <div className="wewrite-card p-4 bg-muted/30 max-w-2xl">
            <p className="text-sm font-medium mb-2">Component Usage</p>
            <pre className="text-xs overflow-x-auto">
{`// UnifiedModal uses Dialog component internally (always centered)
// For alerts/confirmations, use UnifiedModal or its wrappers:

import { ConfirmationModal } from '@/components/utils/UnifiedModal';

<ConfirmationModal
  isOpen={true}
  onClose={handleClose}
  onConfirm={handleConfirm}
  title="Delete Page?"
  message="Are you sure?"
  type="destructive"
/>

// For complex forms/content, use Modal or AdaptiveModal instead`}
            </pre>
          </div>
        </div>
      </StateDemo>

      {/* Rendered Modals */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.variant}
      />

      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title="Information"
        message="This is an alert modal. It only has an OK button to acknowledge the message."
        type="info"
        icon="info"
        buttonText="Got it"
      />

      <PromptModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        onConfirm={(value) => {
          setPromptResult(value);
          setShowPromptModal(false);
        }}
        title="Enter a Value"
        message="Please enter something:"
        placeholder="Type here..."
        confirmText="Submit"
        cancelText="Cancel"
      />
    </ComponentShowcase>
  );
}
