"use client";

import * as React from "react";
import { useContext } from "react";
import { DrawerContext } from "../providers/DrawerProvider";
import { Sidebar } from "./Sidebar";

/**
 * SidebarFromDrawerContext
 *
 * This component renders the Sidebar and connects it to the DrawerContext.
 * It's the only instance of Sidebar that should be used in the application.
 * All menu buttons should use DrawerContext to control this sidebar.
 */
export function SidebarFromDrawerContext() {
  const drawerContext = useContext(DrawerContext);

  if (!drawerContext) {
    console.error("DrawerContext is not available in SidebarFromDrawerContext");
    return null;
  }

  const { isOpen, setIsOpen } = drawerContext;

  console.log("SidebarFromDrawerContext: isOpen =", isOpen);

  const handleClose = () => {
    console.log("SidebarFromDrawerContext: closing sidebar");
    setIsOpen(false);
  };

  return <Sidebar isOpen={isOpen} onClose={handleClose} />;
}
