"use client";

import * as React from "react";
import Link from "next/link";
import { useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";

export default function Header() {
  const { user } = useContext(AuthContext);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b h-16">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold">
          WeWrite
        </Link>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/pages" className="hover:text-primary">
                My Pages
              </Link>
              <Link href="/pages/new" className="hover:text-primary">
                New Page
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hover:text-primary">
                Login
              </Link>
              <Link href="/auth/register" className="hover:text-primary">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
} 