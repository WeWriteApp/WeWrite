"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState, useEffect } from "react"
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
  const [isFormValid, setIsFormValid] = useState(false)

  // Validate form inputs
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isEmailValid = emailRegex.test(email)
    const isPasswordValid = password.length >= 6
    setIsFormValid(isEmailValid && isPasswordValid)
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
    try {
      const result = await loginUser(email, password)
      
      if (result.user) {
        // Successful login - redirect to home page
        console.log("Login successful, redirecting...")
        
        // Increase timeout to allow auth state to fully propagate
        // and ensure cookies are properly set
        localStorage.setItem('authRedirectPending', 'true')
        
        setTimeout(() => {
          localStorage.removeItem('authRedirectPending')
          router.push("/")
          // Force a refresh of the page to ensure auth state is recognized
          router.refresh()
        }, 1500)
      } else {
        // Error handling
        const errorCode = result.code || ""
        let errorMessage = result.message || "Failed to sign in. Please try again."
        
        if (errorCode.includes("user-not-found") || errorCode.includes("wrong-password")) {
          errorMessage = "Invalid email or password"
        } else if (errorCode.includes("too-many-requests")) {
          errorMessage = "Too many attempts. Please try again later."
        }
        
        setError(errorMessage)
      }
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err?.message || "An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form 
      className={cn("flex flex-col gap-3 sm:gap-6", className)} 
      {...props} 
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-center gap-1 sm:gap-2 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Log in</h1>
      </div>
      <div className="grid gap-3 sm:gap-6">
        <div className="grid gap-1 sm:gap-2">
          <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="thomaspaine@example.com" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            tabIndex={1}
            className="bg-background border-input text-foreground placeholder:text-muted-foreground h-9 sm:h-10"
          />
        </div>
        <div className="grid gap-1 sm:gap-2">
          <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••"
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            tabIndex={2} 
            className="bg-background border-input text-foreground placeholder:text-muted-foreground h-9 sm:h-10"
          />
          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-xs sm:text-sm underline-offset-4 hover:underline text-muted-foreground hover:text-foreground"
              tabIndex={3} 
            >
              Forgot your password?
            </Link>
          </div>
        </div>
        
        {error && (
          <div className="text-xs sm:text-sm font-medium text-destructive">
            {error}
          </div>
        )}
        
        <Button 
          type="submit" 
          className={cn(
            "w-full transition-all",
            !isFormValid && !isLoading ? 
              "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : ""
          )}
          disabled={isLoading || !isFormValid} 
          tabIndex={4}
        >
          {isLoading ? "Signing in..." : "Login"}
        </Button>
      </div>
      <div className="text-center text-xs sm:text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="underline underline-offset-4 text-foreground hover:text-foreground/90" tabIndex={5}>
          Sign up
        </Link>
      </div>
    </form>
  )
}
