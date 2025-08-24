"use client";

import Link from "next/link";
import { Button } from "../ui/button";

export default function LoginBanner() {
  return (
    <div className="w-full bg-primary text-primary-foreground border-b shadow-md">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
        <p className="text-sm">
          Want to start writing? Sign in or create an account!
        </p>
        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button
              variant="secondary"
              className="transition-all duration-200 hover:scale-105 hover:shadow-md border-primary-foreground text-primary-foreground hover:bg-primary-foreground/20"
            >
              Sign in
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button
              variant="default"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 transition-all duration-200 hover:scale-105 hover:shadow-md border-none"
            >
              Create account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}