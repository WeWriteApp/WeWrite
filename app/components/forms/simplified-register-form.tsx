"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useState, useEffect } from "react"
import { createUser } from "../../firebase/auth"
import { Loader2 } from "lucide-react"
import { Separator } from "../ui/separator"

export function SimplifiedRegisterForm({
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
      const result = await createUser(email, password)

      if (result.user) {
        console.log("Account created successfully, redirecting to username setup...")
        
        // Store the user's email for the next step
        localStorage.setItem('pendingUserEmail', email)
        localStorage.setItem('pendingUserId', result.session.uid)
        
        // Redirect to username setup page
        router.push('/auth/setup-username')
      } else {
        // Handle error from createUser
        const errorCode = result.code || ""
        let errorMessage = result.message || "Failed to create account. Please try again."

        if (errorCode.includes("email-already-in-use")) {
          errorMessage = "Email already in use. Try logging in instead."
        } else if (errorCode.includes("weak-password")) {
          errorMessage = "Password is too weak. Please choose a stronger password."
        } else if (errorCode.includes("invalid-email")) {
          errorMessage = "Please enter a valid email address."
        }

        setError(errorMessage)
        setIsLoading(false)
      }
    } catch (error: any) {
      console.error("Registration error:", error)
      setError(error.message || "An unexpected error occurred")
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
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start with your email and password. You'll choose your username next.
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
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            tabIndex={2}
            className="h-10 bg-background"
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            Password must be at least 6 characters
          </p>
        </div>

        {error && (
          <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className={cn(
            "w-full h-10 font-medium",
            !isFormValid && !isLoading ?
              "opacity-50 cursor-not-allowed" : ""
          )}
          disabled={isLoading || !isFormValid}
          tabIndex={3}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Continue"
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
        onClick={() => router.push('/auth/login')}
      >
        Sign in with existing account
      </Button>

      <div className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-4 text-foreground hover:text-foreground/90"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-4 text-foreground hover:text-foreground/90"
        >
          Privacy Policy
        </Link>
      </div>
    </form>
  )
}