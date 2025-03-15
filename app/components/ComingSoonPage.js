"use client";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { cn } from "../lib/utils";
import DashboardLayout from "../DashboardLayout";
import EmptyState from "./EmptyState";

const ComingSoonPage = ({ 
  title,
  description = "This feature is coming soon. Check back later!",
  icon,
  actionLabel = "Back to home",
  actionHref = "/",
  docsLink
}) => {
  return (
    <DashboardLayout>
      <div className="h-[80vh] flex items-center justify-center">
        <div className={cn(
          "max-w-md w-full p-8 rounded-lg border border-border bg-card text-card-foreground",
          "transition-all duration-200 hover:shadow-lg hover:border-border/50"
        )}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Icon icon={icon} className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
            {docsLink && (
              <Link 
                href={`/pages/${docsLink}`}
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Read More
                <Icon icon="ph:arrow-right" className="ml-2 w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ComingSoonPage; 