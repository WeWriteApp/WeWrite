"use client";

import Link from "next/link";
import Button from "./Button";
import { useEffect, useState } from "react";

export default function LoginBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(currentScrollY <= lastScrollY || currentScrollY < 10);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ${
      isVisible ? "translate-y-0" : "translate-y-full"
    }`}>
      <div className="w-full p-4 bg-background border-t">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Want to start writing? Sign in or create an account!
          </p>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="default">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="outline">
                Create account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 