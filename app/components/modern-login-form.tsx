"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState, useEffect } from "react"
import { loginUser, loginAnonymously } from "../firebase/auth"
import { Loader2, AlertCircle } from "lucide-react"
import { Separator } from "../components/ui/separator"
// reCAPTCHA functionality removed
import { Alert, AlertDescription } from "../components/ui/alert"

export function ModernLoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)
  const [previousAccount, setPreviousAccount] = useState<{ email: string } | null>(null)
  // reCAPTCHA states removed

  // Validate form inputs
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isEmailValid = emailRegex.test(email)
    const isPasswordValid = password.length >= 6
    setIsFormValid(isEmailValid && isPasswordValid)
  }, [email, password])

  // Check for previous account
  useEffect(() => {
    const previousUserSession = localStorage.getItem('previousUserSession')
    if (previousUserSession) {
      try {
        const parsedSession = JSON.parse(previousUserSession)
        if (parsedSession && parsedSession.email) {
          setPreviousAccount(parsedSession)
        }
      } catch (e) {
        console.error('Error parsing previous user session:', e)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // reCAPTCHA verification removed
      const result = await loginUser(email, password)

      if (result.user) {
        // Successful login - redirect to home page
        console.log("Login successful, redirecting...")

        // Check if we're adding a new account to the account switcher
        const previousUserSession = localStorage.getItem('previousUserSession') ||
                                   sessionStorage.getItem('wewrite_previous_user')

        if (previousUserSession) {
          console.log("Adding new account to account switcher...")
          // This is handled by the MultiAccountProvider
        }

        // Increase timeout to allow auth state to fully propagate
        // and ensure cookies are properly set
        localStorage.setItem('authRedirectPending', 'true')

        setTimeout(() => {
          localStorage.removeItem('authRedirectPending')
          window.location.href = "/"; // Use direct navigation for better compatibility
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
    } catch (error: any) {
      console.error("Login error:", error)
      setError(error.message || "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      {...props}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Sign in to WeWrite</h1>
        <p className="text-sm text-muted-foreground">
          Enter your details below to sign in to your account
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            tabIndex={1}
            className="h-10 bg-background"
            autoComplete="email"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-primary hover:underline"
              tabIndex={3}
            >
              Forgot password?
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
            className="h-10 bg-background"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* reCAPTCHA UI elements removed */}

        <Button
          type="submit"
          className={cn(
            "w-full h-10 font-medium",
            !isFormValid && !isLoading ?
              "opacity-50 cursor-not-allowed" : ""
          )}
          disabled={isLoading || !isFormValid}
          tabIndex={4}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </div>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white dark:bg-gray-900 px-2 text-xs text-muted-foreground">
            OR
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-10"
        onClick={() => router.push('/auth/register')}
      >
        Create an account
      </Button>
    </form>
  )
}
