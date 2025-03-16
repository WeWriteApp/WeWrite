"use client";

import { ReactNode } from "react";
import { Drawer as DrawerComponent } from "./Drawer.js";

// TypeScript wrapper for the Drawer component
export function Drawer({ children }: { children?: ReactNode }) {
  return <DrawerComponent>{children}</DrawerComponent>;
} 