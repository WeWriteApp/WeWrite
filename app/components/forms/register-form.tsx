"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useState, useEffect, useCallback } from "react"
// Firebase imports for registration
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { createEmailVerificationNotification } from '../../services/notificationsApi'
import { Check, Loader2, X, Copy, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { InlineError } from "../ui/InlineError"
import { debounce } from "lodash"
import { Separator } from "../ui/separator"
import { validateUsernameFormat, getUsernameErrorMessage, generateUsernameSuggestions } from "../../utils/usernameValidation"
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics"
import { transferLoggedOutAllocationsToUser } from "../../utils/simulatedTokens"
import { useAuth } from "../../providers/AuthProvider"

export function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const { trackAuthEvent } = useWeWriteAnalytics()
  const { refreshUser } = useAuth()
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
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([])
  
  // Error details for copy functionality
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Validate form inputs
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isEmailValid = emailRegex.test(email)
    const isPasswordValid = password.length >= 6
    // Username is valid if it's at least 3 characters and available (not taken)
    const isUsernameValid = username.length >= 3 && isAvailable === true && !validationError

    setIsFormValid(isEmailValid && isPasswordValid && isUsernameValid)
  }, [email, password, username, isAvailable, validationError])

  // Username validation function (memoized to prevent infinite re-renders)
  const checkUsername = useCallback(
    debounce(async (value: string) => {
      // Reset validation state
      setValidationError(null)
      setValidationMessage(null)
      setUsernameSuggestions([])

      // Skip validation for empty usernames
      if (!value) {
        setIsAvailable(null)
        return
      }

      // First, validate format client-side
      const formatValidation = validateUsernameFormat(value)
      if (!formatValidation.isValid) {
        setIsAvailable(false)
        setValidationError(formatValidation.error)
        setValidationMessage(formatValidation.message)

        // If it contains whitespace, suggest cleaned versions
        if (formatValidation.error === "CONTAINS_WHITESPACE") {
          const suggestions = generateUsernameSuggestions(value)
          setUsernameSuggestions(suggestions)
        }
        return
      }

      // Check availability
      setIsChecking(true)
      try {
        // Call API endpoint to check username availability
        const response = await fetch(`/api/users/username?username=${encodeURIComponent(value)}`)

        if (!response.ok) {
          throw new Error(`Failed to check username: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to check username availability')
        }

        const data = result.data
        setIsAvailable(data.available)

        if (data.available) {
          setValidationError(null)
          setValidationMessage("Username is available")
          setUsernameSuggestions([])
        } else {
          setValidationError("USERNAME_TAKEN")
          setValidationMessage(data.error || "Username already taken")

          // Set username suggestions if available (prefer array, fallback to single)
          if (data.suggestions && data.suggestions.length > 0) {
            setUsernameSuggestions(data.suggestions)
          } else if (data.suggestion) {
            setUsernameSuggestions([data.suggestion])
          } else {
            setUsernameSuggestions([])
          }
        }
      } catch (error) {
        console.error("Error checking username:", error)
        setIsAvailable(false)
        setValidationError("CHECK_FAILED")
        setValidationMessage("Could not verify username availability. Please try again.")

        // Prevent infinite loops by not retrying automatically
        // User can manually retry by changing the username
      } finally {
        setIsChecking(false)
      }
    }, 500),
    [] // Empty dependency array since we don't want this to change
  )

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

  // Handle clicking on a username suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion)
    // Immediately check the availability of the suggested username
    checkUsername.cancel()
    checkUsername(suggestion)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Explicitly check for empty username, though button should be disabled
    if (!username) {
      setError("Username is required.")
      return
    }

    setError(null)
    setErrorDetails(null)
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
      // Step 1: Create user with Firebase Client SDK (no server-side firebase-admin needed)
      console.log('[Register] Creating user with Firebase Client SDK...')
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      console.log('[Register] Firebase user created:', user.uid)

      // Step 2: Get the ID token for API authentication
      const idToken = await user.getIdToken()

      // Step 3: Call API to create Firestore documents (uses REST API, not firebase-admin)
      console.log('[Register] Creating user documents via API...')
      const response = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email,
          username,
          idToken
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Clear any previous errors on success
        setError(null)
        setErrorDetails(null)
        console.log("Account created successfully:", result.data)

        // Step 4: Get a fresh ID token (after Firestore docs are created)
        console.log('[Register] Getting fresh ID token for session...')
        const freshIdToken = await user.getIdToken(true) // force refresh

        // Step 5: Create server-side session (same as login flow)
        console.log('[Register] Creating server-side session...')
        const sessionResponse = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ idToken: freshIdToken })
        })

        if (!sessionResponse.ok) {
          const sessionError = await sessionResponse.text()
          console.error('[Register] Session creation failed:', sessionResponse.status, sessionError)
          // Don't fail registration, but log the issue
        } else {
          const sessionData = await sessionResponse.json()
          console.log('[Register] Session created successfully:', sessionData)
        }

        // Transfer any logged-out token allocations to the new user
        const transferResult = transferLoggedOutAllocationsToUser(user.uid)
        if (transferResult.success && transferResult.transferredCount > 0) {
          console.log(`Transferred ${transferResult.transferredCount} token allocations to new user`)
        }

        // Send verification email via our custom Resend template
        try {
          const verificationResponse = await fetch('/api/email/send-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              userId: user.uid,
              username: username,
              idToken: freshIdToken,
            }),
          })
          
          if (verificationResponse.ok) {
            console.log('Verification email sent successfully to:', email)
          } else {
            console.error('Failed to send verification email via API')
          }
          
          // Create a reminder notification in the notification center
          await createEmailVerificationNotification(user.uid)
          console.log('Email verification reminder notification created')
        } catch (emailError) {
          // Don't fail registration if email sending fails - user can resend from banner
          console.error('Failed to send verification email:', emailError)
        }

        // Track user creation event
        trackAuthEvent('USER_CREATED', {
          user_id: user.uid,
          username: username,
          email: email,
          registration_method: 'email_password'
        })

        // Show redirect overlay
        setIsRedirecting(true)

        // Redirect to home page
        console.log("Account created successfully, refreshing auth state and redirecting to home")

        // Refresh the auth provider state so it picks up the new session
        try {
          await refreshUser()
          console.log('[Register] Auth state refreshed successfully')
        } catch (refreshError) {
          console.warn('[Register] Auth refresh warning (non-blocking):', refreshError)
        }

        // Navigate to email verification pending page after a short delay
        setTimeout(() => {
          router.push('/auth/verify-email-pending')
        }, 500)

      } else {
        // Handle API error response - user was created in Firebase Auth but documents failed
        let errorMessage = result.error || "Failed to complete account setup. Please try logging in."

        if (errorMessage.includes("Username is already taken")) {
          errorMessage = "Username is already taken. Please choose a different username."
          // Note: User exists in Firebase Auth but not in Firestore - they can try again
        }

        // Capture full error details for support
        const details = JSON.stringify({
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          errorCode: result.data?.errorCode || 'unknown',
          errorId: result.data?.errorId || 'none',
          message: errorMessage,
          url: '/api/auth/register-user',
          note: 'Firebase Auth user was created but Firestore documents may have failed'
        }, null, 2)
        setErrorDetails(details)
        console.error("Registration API error:", details)
        
        setError(errorMessage)
        setIsLoading(false)
      }
    } catch (error: any) {
      // Handle Firebase Auth errors specifically
      let errorMessage = error?.message || "An unexpected error occurred"
      
      // Map Firebase Auth error codes to user-friendly messages
      // These are SPECIFIC about what the problem is
      if (error?.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already registered. Try logging in instead, or use a different email."
      } else if (error?.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please choose a stronger password (at least 6 characters)."
      } else if (error?.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address format."
      } else if (error?.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/password accounts are not enabled. Please contact support."
      } else if (error?.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please wait a few minutes and try again."
      } else if (error?.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your connection and try again."
      }

      // Capture full error details including stack trace
      const details = JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'client_exception',
        name: error?.name || 'Error',
        message: error?.message || errorMessage,
        code: error?.code || 'unknown',
        stack: error?.stack?.split('\n').slice(0, 5) || [],
        step: 'firebase_auth_create_user'
      }, null, 2)
      setErrorDetails(details)
      console.error("Registration client error:", details)
      console.error("Registration error (raw):", error)
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      {...props}
      onSubmit={handleSubmit}
      name="wewrite-register"
      action="https://www.getwewrite.app/auth/register"
      method="POST"
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
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
              name="username"
              type="text"
              placeholder="yourname"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              tabIndex={1}
              className={cn(
                "h-10 pr-10",
                validationError ? "border-destructive focus-visible:ring-destructive" : "",
                isAvailable === true ? "border-success focus-visible:ring-success" : ""
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
            <div className={cn(
              "mt-1",
              validationError ? "text-destructive" : "text-muted-foreground"
            )}>
              <p className="text-xs">{validationMessage}</p>

              {/* Username suggestions */}
              {(validationError === "USERNAME_TAKEN" || validationError === "CONTAINS_WHITESPACE") && usernameSuggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-foreground mb-1.5">
                    {validationError === "CONTAINS_WHITESPACE" ? "Try this instead:" : "Try one of these instead:"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {usernameSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-2 py-1 text-xs font-medium rounded-md bg-background border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
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
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              tabIndex={3}
              className="h-10 bg-background pr-10"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Password must be at least 6 characters
          </p>
        </div>

        {error && (
          <InlineError
            message={error}
            variant="error"
            size="md"
            errorDetails={errorDetails || undefined}
            showCopy={!!errorDetails}
          />
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
          <span className="bg-background px-2 text-xs text-muted-foreground">
            OR
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full h-10"
        onClick={() => router.push('/auth/login')}
      >
        Sign in with existing account
      </Button>
    </form>
  )
}