"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: IconName;
  iconClassName?: string;
  backHref?: boolean | string;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  iconClassName,
  backHref,
  actions,
  badges,
  children,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof backHref === "string") {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {backHref && (
            <button
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <Icon name="ArrowLeft" size={20} />
            </button>
          )}
          {icon && (
            <Icon
              name={icon}
              size={24}
              className={cn("flex-shrink-0", iconClassName)}
            />
          )}
          <h1 className="text-2xl font-bold truncate">{title}</h1>
          {badges}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {actions}
          </div>
        )}
      </div>
      {description && (
        <p className="text-muted-foreground mt-1">{description}</p>
      )}
      {children}
    </div>
  );
}
