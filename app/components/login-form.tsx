"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState } from "react"
import { loginUser } from "../firebase/auth"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
    try {
      const result = await loginUser(email, password)
      
      if (result.user) {
        // Successful login
        router.push("/")
      } else {
        // Error handling
        const errorCode = result.code || ""
        let errorMessage = "Failed to sign in. Please try again."
        
        if (errorCode.includes("user-not-found") || errorCode.includes("wrong-password")) {
          errorMessage = "Invalid email or password"
        } else if (errorCode.includes("too-many-requests")) {
          errorMessage = "Too many attempts. Please try again later."
        }
        
        setError(errorMessage)
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form 
      className={cn("flex flex-col gap-6", className)} 
      {...props} 
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-white">Log into your account</h1>
        <p className="text-balance text-sm text-white/70">
          Enter your email below to login to your account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-white">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="thomaspaine@example.com" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            tabIndex={1}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-white">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline text-white/80"
              tabIndex={3} 
            >
              Forgot your password?
            </Link>
          </div>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••"
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            tabIndex={2} 
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
        
        {error && (
          <div className="text-sm font-medium text-red-400">
            {error}
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-white text-blue-950 hover:bg-white/90" 
          disabled={isLoading} 
          tabIndex={4}
        >
          {isLoading ? "Signing in..." : "Login"}
        </Button>
      </div>
      <div className="text-center text-sm text-white/80">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="underline underline-offset-4 text-white hover:text-white/90" tabIndex={5}>
          Sign up
        </Link>
      </div>
    </form>
  )
}
