"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { FileText, Lock, Globe, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

const GroupPages = ({ pages }) => {
  if (!pages || Object.keys(pages).length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {Object.entries(pages).map(([pageId, page]) => (
        <Link key={pageId} href={`/pages/${pageId}`}>
          <Card className="hover:shadow-md transition-all duration-200 cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  "bg-primary/10 text-primary"
                )}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{page.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {new Date(page.lastModified || page.createdAt).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      {page.isPublic ? (
                        <>
                          <Globe className="h-3 w-3" />
                          <span>Public</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>Private</span>
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default GroupPages;