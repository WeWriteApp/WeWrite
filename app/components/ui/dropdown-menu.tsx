"use client"

import * as React from "react"
import { Check, ChevronRight, Circle } from "lucide-react"
import { cn } from "../../lib/utils"

// SIMPLE dropdown - no Radix UI, just basic show/hide
const DropdownContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);

  // Close on outside click
  React.useEffect(() => {
    const handleClick = () => setOpen(false);
    if (open) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
};

const DropdownMenuTrigger = ({ children, className, asChild, ...props }: any) => {
  const { setOpen } = React.useContext(DropdownContext);

  // If asChild is true, clone the child and add our click handler
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e: any) => {
        e.stopPropagation();
        setOpen((prev: boolean) => !prev);
        // Call original onClick if it exists
        if (children.props.onClick) {
          children.props.onClick(e);
        }
      }
    });
  }

  // Otherwise render as a button (but remove asChild from DOM props)
  const { asChild: _, ...domProps } = props;
  return (
    <button
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(prev => !prev);
      }}
      {...domProps}
    >
      {children}
    </button>
  );
};

const DropdownMenuContent = ({ children, className, ...props }: any) => {
  const { open } = React.useContext(DropdownContext);
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute right-0 top-full mt-1 z-[80] min-w-[8rem] overflow-hidden rounded-xl border-theme-strong bg-card text-card-foreground shadow-lg",
        "dark:bg-card/95 dark:backdrop-blur-sm",
        "p-2",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
};

const DropdownMenuItem = ({ children, className, onClick, ...props }: any) => {
  const { setOpen } = React.useContext(DropdownContext);
  return (
    <div
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </div>
  );
};

const DropdownMenuSeparator = ({ className, ...props }: any) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
);

const DropdownMenuLabel = ({ children, className, ...props }: any) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props}>
    {children}
  </div>
);

// Simple implementations for other components
const DropdownMenuGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuSubContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuSubTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuRadioGroup = ({
  children,
  value,
  onValueChange
}: {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}) => (
  <div data-value={value} data-onvaluechange={onValueChange?.toString()}>
    {children}
  </div>
);

const DropdownMenuRadioItem = ({
  children,
  value,
  onClick
}: {
  children: React.ReactNode;
  value?: string;
  onClick?: () => void;
}) => (
  <div
    className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground"
    onClick={onClick}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <div className="h-2 w-2 rounded-full bg-current" />
    </span>
    {children}
  </div>
);
const DropdownMenuCheckboxItem = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuShortcut = ({ children }: { children: React.ReactNode }) => <span>{children}</span>;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}