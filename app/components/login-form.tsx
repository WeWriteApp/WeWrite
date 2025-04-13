"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { LoadingButton } from "../components/ui/loading-button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState, useEffect } from "react"
import { loginUser } from "../firebase/auth"
import { AuthRedirectOverlay } from "./AuthRedirectOverlay"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Validate form inputs
  useEffect(() => {
    // If input contains @, validate as email, otherwise as username
    let isInputValid = false;
    if (emailOrUsername.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      isInputValid = emailRegex.test(emailOrUsername);
    } else {
      // Username validation - at least 3 characters, alphanumeric + underscore
      isInputValid = emailOrUsername.length >= 3 && /^[a-zA-Z0-9_]+$/.test(emailOrUsername);
    }

    const isPasswordValid = password.length >= 6
    setIsFormValid(isInputValid && isPasswordValid)
  }, [emailOrUsername, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await loginUser(emailOrUsername, password)

      if (result.user) {
        // Successful login - redirect to home page
        console.log("Login successful, redirecting...")

        // Show redirect overlay
        setIsRedirecting(true)

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
    <>
      <AuthRedirectOverlay isVisible={isRedirecting} message="Logging you in..." />
      <form
        className={cn("flex flex-col gap-3 sm:gap-4", className)}
        {...props}
        onSubmit={handleSubmit}
      >
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Log in</h1>
      </div>
      <div className="grid gap-3 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emailOrUsername" className="text-foreground text-sm sm:text-base">Email or Username</Label>
          <Input
            id="emailOrUsername"
            type="text"
            placeholder="thomaspaine@example.com or thomaspaine"
            required
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            tabIndex={1}
            className="bg-background border-input text-foreground placeholder:text-muted-foreground h-10 sm:h-11 px-3"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-foreground text-sm sm:text-base">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            tabIndex={2}
            className="bg-background border-input text-foreground placeholder:text-muted-foreground h-10 sm:h-11 px-3"
          />
          <div className="flex justify-end mt-1">
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
          <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <LoadingButton
          type="submit"
          className={cn(
            "w-full transition-all h-10 sm:h-11 mt-2",
            !isFormValid && !isLoading ?
              "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : ""
          )}
          isLoading={isLoading}
          loadingText="Signing in..."
          disabled={!isFormValid}
          tabIndex={4}
        >
          Login
        </LoadingButton>
      </div>
      <div className="text-center text-sm sm:text-base text-muted-foreground mt-2">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="underline underline-offset-4 text-foreground hover:text-foreground/90 font-medium" tabIndex={5}>
          Sign up
        </Link>
      </div>
    </form>
    </>
  )
}
