"use client"

import * as React from "react"
import Link from "next/link"

interface LinkButtonProps {
  href: string
  children: React.ReactNode
  className?: string
}

export default function LinkButton({ href, children, className = "" }: LinkButtonProps) {
  return (
    <Link 
      href={href}
      className={`flex items-center gap-[10px] px-[10px] py-[8px] border border-white/30 bg-white/10 hover:bg-white/25 hover:scale-101 active:scale-99 rounded-xl font-medium cursor-pointer ${className}`}
    >
      {children}
    </Link>
  )
} 