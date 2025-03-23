"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";

export function Hero() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-black">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                WeWrite
              </h1>
              <p className="max-w-[600px] text-gray-300 md:text-xl">
                A social notes app where every page is a fundraiser. Monetize your ideas!
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link href="/auth/register">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Start writing
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" className="border-white/20 hover:bg-white/10">
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-[500px] aspect-[4/3] overflow-hidden rounded-xl bg-blue-950/30">
              {/* Fallback div in case image is missing */}
              <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold text-xl">
                WeWrite App
              </div>
              <Image
                src="/images/hero-image.png"
                alt="WeWrite App Screenshot"
                fill
                className="object-cover"
                priority
                onError={(e) => {
                  // Hide the image on error
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
