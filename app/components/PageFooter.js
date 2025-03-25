"use client";

import React from "react";

export default function PageFooter() {
  return (
    <div className="mt-8 py-4 border-t border-border">
      <div className="text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} WeWrite. All rights reserved.</p>
      </div>
    </div>
  );
}
