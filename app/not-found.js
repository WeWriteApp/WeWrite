"use client";

import Link from "next/link";
import { useAuth } from "./providers/AuthProvider";
import { Button } from "./components/ui/button";

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-lg text-muted-foreground mb-8">Sorry, we couldn't find the page you're looking for.</p>
      <Button asChild>
        <Link href={user ? "/" : "/auth/login"}>
          {user ? "Back to Home" : "Log in"}
        </Link>
      </Button>
    </div>
  );
}