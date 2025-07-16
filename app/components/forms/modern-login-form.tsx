"use client"

/**
 * WeWrite Authentication Improvements - Modern Login Form
 *
 * Enhanced login form component that supports flexible login options and
 * improved user experience as part of the authentication improvements.
 *
 * Key Features Implemented:
 * 1. **Flexible Login Options**: Users can log in using either username OR email
 * 2. **Enhanced Error Handling**: Specific Firebase error code handling
 * 3. **Improved UX**: Better form validation and user feedback
 * 4. **Security**: Username lookup without exposing user emails
 *
 * Authentication Flow:
 * - Accepts both email format and username format in single input
 * - Modified loginUser function queries usernames collection for lookup
 * - Enhanced form validation for both input types
 * - Improved error messaging for better user guidance
 *
 * Technical Implementation:
 * - Single input field labeled "Email or Username"
 * - Backend logic handles username-to-email conversion
 * - Maintains security by not exposing user emails
 * - Compatible with existing user data and authentication flow
 *
 * Performance Impact:
 * - Minimal performance impact from username lookup (single Firestore query)
 * - Improved user experience reduces failed login attempts
 * - Simplified form reduces cognitive load for users
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Separator } from "../ui/separator"
// reCAPTCHA functionality removed
import { Alert, AlertDescription } from "../ui/alert"
import { PageLoader } from "../ui/page-loader"
import { validateLoginInput } from "../../utils/usernameValidation"

export function ModernLoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [inputValidationError, setInputValidationError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormValid, setIsFormValid] = useState(false)
  const [previousAccount, setPreviousAccount] = useState<{ email: string } | null>(null)
  // reCAPTCHA states removed

  // Validate form inputs
  useEffect(() => {
    // Clear previous input validation error when user starts typing
    if (inputValidationError && emailOrUsername.length > 0) {
      setInputValidationError(null)
    }

    // Validate email or username input
    const inputValidation = validateLoginInput(emailOrUsername)
    const isPasswordValid = password.length >= 6

    // Only show input validation error if user has typed something and it's invalid
    if (emailOrUsername.length > 0 && !inputValidation.isValid) {
      setInputValidationError(inputValidation.message)
    } else {
      setInputValidationError(null)
    }

    // Form is valid if both input and password are valid
    setIsFormValid(inputValidation.isValid && isPasswordValid)
  }, [emailOrUsername, password, inputValidationError])

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
        console.error('Error parsing previous user account:', e)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInputValidationError(null)
    setIsLoading(true)

    try {
      // Call API endpoint for login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailOrUsername,
          password
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Successful login - handle through session management API
        console.log("Login successful:", result.data)

        try {
          // Check if this is development auth (mock token) or production auth (real token)
          const isDevelopmentAuth = result.data.customToken?.startsWith('dev_token_');

          if (isDevelopmentAuth) {
            console.log("Development authentication - creating session directly")

            // For development auth, create session directly without Firebase
            const sessionResponse = await fetch('/api/auth/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user: result.data,
                isDevelopment: true
              })
            });

            if (sessionResponse.ok) {
              console.log("Development session created successfully")
              window.location.href = "/"
            } else {
              throw new Error('Failed to create development session')
            }

          } else {
            console.log("Production authentication - using Firebase custom token")

            // For production auth, we need to use Firebase (but through API)
            const firebaseResponse = await fetch('/api/auth/firebase-signin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                customToken: result.data.customToken
              })
            });

            if (firebaseResponse.ok) {
              console.log("Production Firebase sign-in successful")
              window.location.href = "/"
            } else {
              throw new Error('Failed to sign in with Firebase')
            }
          }

        } catch (authError: any) {
          console.error("Authentication error:", authError)
          setError("Authentication failed. Please try again.")
        }
      } else {
        // Handle API error response
        let errorMessage = result.error || "Failed to sign in. Please try again."

        if (errorMessage.includes("No account found") || errorMessage.includes("user-not-found")) {
          errorMessage = "No account found with this username or email"
        } else if (errorMessage.includes("Invalid email") || errorMessage.includes("invalid-email")) {
          errorMessage = "Invalid email address"
        } else if (errorMessage.includes("user-disabled")) {
          errorMessage = "This account has been disabled"
        } else if (errorMessage.includes("too-many-requests")) {
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
    <>
      {/* Full-screen loading overlay */}
      {isLoading && (
        <PageLoader
          message="Signing you in..."
          fullScreen={true}
          className="z-[9999]"
        />
      )}

      <form
        className={cn("flex flex-col gap-4", className)}
        {...props}
        onSubmit={handleSubmit}
      >
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Sign in to WeWrite</h1>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emailOrUsername" className="text-sm font-medium">
            Email or Username
          </Label>
          <Input
            id="emailOrUsername"
            type="text"
            placeholder="name@example.com or username"
            required
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            tabIndex={1}
            className={cn(
              "h-10 bg-background",
              inputValidationError && "border-red-500 focus:border-red-500"
            )}
            autoComplete="username"
          />
          {inputValidationError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span>{inputValidationError}</span>
            </div>
          )}
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
          Sign in
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
    </>
  )
}