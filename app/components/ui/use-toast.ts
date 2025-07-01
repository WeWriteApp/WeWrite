import * as React from "react"
import { copyToClipboard } from "../../utils/clipboard"

import type {
  ToastActionElement,
  ToastProps} from "./toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST"} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: string
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: string
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT)}

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        )}

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false}
            : t
        )}
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: []}
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId)}
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId})
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * Creates a copy action element for toasts
 */
const createCopyAction = (textToCopy: string): ToastActionElement => {
  // Validate input
  if (!textToCopy || typeof textToCopy !== 'string' || !textToCopy.trim()) {
    console.warn('createCopyAction: Invalid textToCopy provided:', textToCopy);
    // Return null instead of a disabled button to avoid rendering issues
    return null as any;
  }

  const handleCopy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const success = await copyToClipboard(textToCopy);
      if (success) {
        // Show a brief success toast (use base toast function to avoid copy button)
        toast({
          title: "Copied to clipboard",
          variant: "success",
          duration: 2000});
      } else {
        // Show error toast if copy fails (use base toast function to avoid copy button)
        toast({
          title: "Failed to copy",
          description: "Please try selecting and copying the text manually",
          variant: "destructive",
          duration: 3000});
      }
    } catch (error) {
      console.error('Error in copy action:', error);
      // Use base toast function to avoid copy button recursion
      toast({
        title: "Copy failed",
        description: "An error occurred while copying",
        variant: "destructive",
        duration: 3000});
    }
  };

  // Create a simple button element that matches ToastAction structure
  const copyButton = React.createElement(
    'button',
    {
      onClick: handleCopy,
      className: "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive gap-1.5",
      type: "button"},
    React.createElement(Copy, { className: "h-3.5 w-3.5" }),
    "Copy"
  );

  return copyButton as ToastActionElement;
};

export function toast({
  ...props
}: Omit<ToasterToast, "id">) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id }})
  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      }}})

  return {
    id,
    dismiss,
    update}
}

// Helper functions for common toast types
toast.success = (title: string, options?: Omit<ToasterToast, "id" | "title" | "variant">) => {
  return toast({ title, variant: "success", ...options });
};

toast.error = (
  title: string,
  options?: Omit<ToasterToast, "id" | "title" | "variant"> & {
    enableCopy?: boolean;
    copyText?: string;
  }
) => {
  const { enableCopy = true, copyText, ...toastOptions } = options || {};

  // Validate title
  if (!title || typeof title !== 'string') {
    console.warn('toast.error: Invalid title provided:', title);
    title = 'An error occurred';
  }

  const finalOptions: Omit<ToasterToast, "id" | "title" | "variant"> = {
    ...toastOptions,
    variant: "destructive"};

  // Add copy functionality through description if enabled
  if (enableCopy && copyText && typeof copyText === 'string' && copyText.trim()) {
    const originalDescription = finalOptions.description || '';

    // Create description with copy button using React elements
    finalOptions.description = React.createElement(
      'div',
      { className: 'flex items-start justify-between gap-2' },
      React.createElement(
        'span',
        { className: 'flex-1' },
        originalDescription
      ),
      React.createElement(
        'button',
        {
          onClick: async (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const success = await copyToClipboard(copyText);
              if (success) {
                toast({
                  title: "Copied to clipboard",
                  variant: "success",
                  duration: 2000});
              } else {
                toast({
                  title: "Failed to copy",
                  variant: "destructive",
                  duration: 3000});
              }
            } catch (error) {
              console.error('Copy error:', error);
            }
          },
          className: 'ml-2 p-1 rounded hover:bg-destructive-foreground/10 transition-colors',
          title: 'Copy error details',
          type: 'button'
        },
        React.createElement(
          'svg',
          {
            className: 'h-3 w-3',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24'
          },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 2,
            d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
          })
        )
      )
    );
  }

  return toast({ title, ...finalOptions });
};

toast.info = (title: string, options?: Omit<ToasterToast, "id" | "title" | "variant">) => {
  return toast({ title, variant: "info", ...options });
};

toast.warning = (title: string, options?: Omit<ToasterToast, "id" | "title" | "variant">) => {
  return toast({ title, variant: "warning", ...options });
};

toast.dismiss = (toastId?: string) => {
  dispatch({ type: actionTypes.DISMISS_TOAST, toastId })
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId })}
}