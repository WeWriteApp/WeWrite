"use client";

import React from "react";
import SiteFooter from "./SiteFooter";

export default function PageFooter() {
  return (
    <>
      <div className="mt-8 py-4 border-t border-border">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Report Issue
            </button>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Share
            </button>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
