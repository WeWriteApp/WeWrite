"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState, useEffect } from "react"
import { createUser, addUsername, checkUsernameAvailability, loginAnonymously } from "../firebase/auth"
import { Check, Loader2, X } from "lucide-react"
import { debounce } from "lodash"
import { Separator } from "../components/ui/separator"

export function ModernRegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Username validation state
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  // Validate form inputs
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isEmailValid = emailRegex.test(email)
    const isPasswordValid = password.length >= 6
    // Username is valid if it's at least 3 characters and available (not taken)
    const isUsernameValid = username.length >= 3 && isAvailable === true && !validationError

    setIsFormValid(isEmailValid && isPasswordValid && isUsernameValid)
  }, [email, password, username, isAvailable, validationError])

  // Username validation
  const checkUsername = debounce(async (value: string) => {
    // Reset validation state
    setValidationError(null)
    setValidationMessage(null)

    // Skip validation for empty or too short usernames
    if (!value || value.length < 3) {
      setIsAvailable(null)
      if (value.length > 0 && value.length < 3) {
        setValidationError("USERNAME_TOO_SHORT")
        setValidationMessage("Username must be at least 3 characters")
      }
      return
    }

    // Check for valid characters (letters, numbers, underscores)
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/
    if (!validUsernameRegex.test(value)) {
      setIsAvailable(false)
      setValidationError("INVALID_CHARACTERS")
      setValidationMessage("Username can only contain letters, numbers, and underscores")
      return
    }

    // Check availability
    setIsChecking(true)
    try {
      const available = await checkUsernameAvailability(value)
      setIsAvailable(available)
      if (!available) {
        setValidationError("USERNAME_TAKEN")
        setValidationMessage("Username already taken")
      }
    } catch (error) {
      console.error("Error checking username:", error)
      setIsAvailable(false)
      setValidationError("CHECK_FAILED")
      setValidationMessage("Could not verify username availability")
    } finally {
      setIsChecking(false)
    }
  }, 500)

  // Trigger username validation when username changes
  useEffect(() => {
    if (username) {
      checkUsername(username)
    } else {
      setIsAvailable(null)
      setValidationError(null)
      setValidationMessage(null)
    }

    return () => {
      checkUsername.cancel()
    }
  }, [username, checkUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Explicitly check for empty username, though button should be disabled
    if (!username) {
      setError("Username is required.")
      return
    }

    setError(null)
    setIsLoading(true)

    // Validate username availability before submission
    if (username && (!isAvailable || validationError)) {
      // Set both the main form error and the validation error
      setError(validationMessage || "Please choose a different username")
      if (validationError !== "USERNAME_TAKEN") {
        setValidationError("USERNAME_TAKEN")
        setValidationMessage("Username already taken")
      }
      setIsLoading(false)
      return
    }

    try {
      const result = await createUser(email, password)

      if (result.user) {
        // Add username to the user account
        try {
          await addUsername(result.user.uid, username)
          console.log("Username added successfully")

          // Show redirect overlay
          setIsRedirecting(true)

          // Redirect to home page after a short delay
          localStorage.setItem('authRedirectPending', 'true')
          setTimeout(() => {
            localStorage.removeItem('authRedirectPending')
            window.location.href = "/"
          }, 1500)
        } catch (usernameError: any) {
          console.error("Error adding username:", usernameError)
          setError("Account created but failed to set username. Please try again.")
          setIsLoading(false)
        }
      } else {
        // Handle error from createUser
        const errorCode = result.code || ""
        let errorMessage = result.message || "Failed to create account. Please try again."

        if (errorCode.includes("email-already-in-use")) {
          errorMessage = "Email already in use. Try logging in instead."
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
          Pick a username, start writing anonymously
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="username" className={cn(
            "text-sm font-medium",
            validationError ? "text-destructive" : ""
          )}>
            Username
          </Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              placeholder="yourname"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              tabIndex={1}
              className={cn(
                "h-10 bg-background pr-10",
                validationError ? "border-destructive focus-visible:ring-destructive" : "",
                isAvailable === true ? "border-green-500 focus-visible:ring-green-500" : ""
              )}
              autoComplete="username"
            />
            {isChecking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isChecking && username && username.length >= 3 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isAvailable ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          {validationMessage && (
            <p className={cn(
              "text-xs mt-1",
              validationError ? "text-destructive" : "text-muted-foreground"
            )}>
              {validationMessage}
            </p>
          )}
        </div>

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
            tabIndex={2}
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
            tabIndex={3}
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
          tabIndex={4}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
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
    </form>
  )
}
