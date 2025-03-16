"use client";

import * as React from "react";
import { useContext } from "react";
import { DrawerContext } from "../providers/DrawerProvider";

export function Drawer() {
  const { isOpen, setIsOpen, content } = useContext(DrawerContext);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="fixed right-0 top-0 h-full w-80 bg-background shadow-xl">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <h2 className="text-lg font-semibold">Menu</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 hover:bg-accent"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {content}
        </div>
      </div>
    </div>
  );
} 