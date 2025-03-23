"use client";

import Link from "next/link";
import { Button } from "../ui/button";
import { Github, Code } from "lucide-react";

export function DeveloperSection() {
  return (
    <section className="w-full py-12 md:py-24 bg-blue-950/30">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="flex flex-col justify-center space-y-4">
            <div className="inline-block rounded-lg bg-blue-600/10 px-3 py-1 text-sm text-blue-500">
              <Code className="mr-1 h-4 w-4 inline-block" />
              Open Source
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                Are you a developer?
              </h2>
              <p className="max-w-[600px] text-gray-300 md:text-xl">
                We're open source and we'd love your contributions! If you write about your contributions on WeWrite, we can set up a recurring payment to you according to the quality of your work!
              </p>
            </div>
            <div>
              <Link href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">
                <Button className="bg-white text-black hover:bg-white/90">
                  <Github className="mr-2 h-4 w-4" />
                  Visit GitHub Project
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[500px] overflow-hidden rounded-xl bg-gradient-to-br from-blue-950 to-blue-900 p-8 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
                <pre className="font-mono text-sm text-gray-300 overflow-x-auto">
                  <code>{`// Example contribution
function improveReadingExperience() {
  // Add new view mode
  const viewModes = [
    'wrapped',
    'default', 
    'spaced'
  ];
  
  // Apply user preference
  applyViewMode(
    localStorage.getItem('pageViewMode') 
    || 'default'
  );
  
  // Return enhanced experience
  return "Better reading for everyone!";
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
