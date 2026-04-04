"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Icon } from '@/components/ui/Icon';
import { DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "../../lib/utils"
import { Dialog } from "./dialog"
import { useMediaQuery } from '../../hooks/use-media-query'

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

interface CommandDialogProps extends DialogProps {
  shouldFilter?: boolean;
  hashId?: string;
}

/**
 * CommandDialog - Custom portal-based dialog for the command palette.
 *
 * This completely bypasses Radix's DialogPortal/DialogContent rendering.
 * Radix's DialogPortal wraps each child in a separate React portal, and
 * combined with CSS transform from animations, z-index between those
 * portals becomes unreliable — the overlay paints on top of dialog content.
 *
 * Instead, we use a single createPortal call with a simple DOM structure:
 *   <div fixed fullscreen z-[9999]>     ← our portal root
 *     <div bg-black/50 />               ← backdrop (painted first)
 *     <div centered>                     ← card (painted second, on top)
 *       <Command />
 *     </div>
 *   </div>
 *
 * The Dialog wrapper is kept only for URL hash tracking.
 * Escape key and body scroll lock are handled manually.
 */
const CommandDialog = ({ children, shouldFilter, hashId, open, onOpenChange, ...rest }: CommandDialogProps) => {
  const [mounted, setMounted] = React.useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  React.useEffect(() => setMounted(true), []);

  // Escape key to close
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-focus the input when opening
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    // Use a short setTimeout to ensure the portal is fully mounted.
    // On mobile, the proxy input from CommandPaletteProvider holds keyboard
    // activation; transferring focus here keeps the keyboard visible.
    const timer = setTimeout(() => {
      const input = containerRef.current?.querySelector('input');
      input?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <>
      {/* Dialog wrapper purely for URL hash tracking */}
      <Dialog open={open} onOpenChange={onOpenChange} hashId={hashId} {...rest}>
        {null}
      </Dialog>

      {/* Custom portal — completely independent of Radix rendering */}
      {mounted && open && createPortal(
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette"
          aria-describedby="command-dialog-description"
          className="fixed inset-0 z-[9999]"
        >
          {/* Backdrop — painted first, behind card */}
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => onOpenChange?.(false)}
          />

          {isDesktop ? (
            /* Desktop: Centered modal card */
            <div className="absolute inset-0 flex items-start justify-center pt-[min(18vh,140px)] pointer-events-none">
              <div
                className={cn(
                  "pointer-events-auto w-[85%] max-w-lg rounded-2xl",
                  "border border-border shadow-lg bg-[var(--card-bg)]",
                  "overflow-hidden"
                )}
              >
                <div className="p-2">
                  <div id="command-dialog-description" className="sr-only">
                    Search and select commands or options
                  </div>
                  <Command shouldFilter={shouldFilter} className="rounded-none bg-transparent text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:!bg-[var(--card-bg)] [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-1 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-10 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-item]>svg]:h-5 [&_[cmdk-item]>svg]:w-5">
                    {children}
                  </Command>
                </div>
              </div>
            </div>
          ) : (
            /* Mobile: Full-width bottom drawer */
            <div className="absolute inset-0 flex items-end pointer-events-none">
              <div
                className={cn(
                  "pointer-events-auto w-full rounded-t-2xl",
                  "border-t border-x border-border shadow-lg bg-[var(--card-bg)]",
                  "overflow-hidden flex flex-col",
                  "h-[90vh]"
                )}
                style={{ animation: 'cmdDrawerSlideUp 250ms ease-out' }}
              >
                {/* Drag handle visual */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="px-2 pb-2 flex flex-col flex-1 min-h-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
                  <div id="command-dialog-description" className="sr-only">
                    Search and select commands or options
                  </div>
                  <Command shouldFilter={shouldFilter} className="rounded-none bg-transparent text-foreground flex flex-col flex-1 min-h-0 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:!bg-[var(--card-bg)] [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-1 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-10 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-item]>svg]:h-5 [&_[cmdk-item]>svg]:w-5 [&_[cmdk-list]]:flex-1 [&_[cmdk-list]]:!max-h-none">
                    {children}
                  </Command>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & { onClear?: () => void }
>(({ className, onClear, ...props }, ref) => (
  <div className="flex items-center px-3" cmdk-input-wrapper="">
    <Icon name="Search" size={16} className="mr-2 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
    {onClear && (
      <button
        type="button"
        onClick={onClear}
        className="ml-2 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={props.value ? "Clear search" : "Close"}
      >
        <Icon name="X" size={16} />
      </button>
    )}
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

/**
 * CommandList — height-animated wrapper around cmdk's List.
 *
 * Uses a ResizeObserver on cmdk's internal [cmdk-list-sizer] element to track
 * content height, then sets an explicit `height` on the list with a CSS
 * transition. The result: the bottom edge of the palette smoothly grows/shrinks
 * as content changes (typing, expanding groups, search results arriving).
 *
 * max-height still caps at min(70vh, 600px) via CSS so scrolling works when
 * content exceeds the viewport.
 */
const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    let ro: ResizeObserver | null = null;

    const observeSizer = () => {
      const sizer = el.querySelector('[cmdk-list-sizer]') as HTMLElement | null;
      if (!sizer) return;
      ro = new ResizeObserver(() => {
        setHeight(sizer.offsetHeight);
      });
      ro.observe(sizer);
      setHeight(sizer.offsetHeight);
    };

    // The sizer may not exist on first render — watch for it
    const mo = new MutationObserver(observeSizer);
    mo.observe(el, { childList: true });
    observeSizer();

    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);

  return (
    <CommandPrimitive.List
      ref={(node: HTMLDivElement | null) => {
        listRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={cn(
        "overflow-y-auto overflow-x-hidden transition-[height] duration-200 ease-out",
        className
      )}
      style={{ height: `${height}px`, maxHeight: 'min(70vh, 600px)' }}
      {...props}
    />
  );
})

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:bg-[var(--card-bg)]",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-transparent", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-muted data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator
}
