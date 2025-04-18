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
  const [previousAccount, setPreviousAccount] = useState<{ email: string } | null>(null)

  // Validate form inputs
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isEmailValid = emailRegex.test(email)
    const isPasswordValid = password.length >= 6
    setIsFormValid(isEmailValid && isPasswordValid)
  }, [email, password])

  // Check for previous user session on component mount
  useEffect(() => {
    // Check if we're coming back from an aborted login attempt
    const isAddingAccount = localStorage.getItem('addingNewAccount') === 'true' ||
                           sessionStorage.getItem('wewrite_adding_account') === 'true';

    if (isAddingAccount) {
      console.log("Detected aborted account addition, checking for previous user session");

      // Get the previous user session
      const previousUserSession = localStorage.getItem('previousUserSession') ||
                                 sessionStorage.getItem('wewrite_previous_user');

      if (previousUserSession) {
        try {
          const prevUser = JSON.parse(previousUserSession);
          console.log("Found previous user session, returning to previous account");

          // Set the previous account state to show the return button
          setPreviousAccount(prevUser);
        } catch (error) {
          console.error("Error parsing previous user session:", error);
        }
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await loginUser(email, password)

      if (result.user) {
        // Successful login - redirect to home page
        console.log("Login successful, redirecting...")

        // Check if we're adding a new account to the account switcher
        const previousUserSession = localStorage.getItem('previousUserSession') ||
                                   sessionStorage.getItem('wewrite_previous_user')

        if (previousUserSession) {
          console.log("Adding new account to account switcher...")

          try {
            // Get the previous user session
            const prevUser = JSON.parse(previousUserSession)

            // Get any existing saved accounts
            let savedAccounts = []
            const savedAccountsJson = localStorage.getItem('savedAccounts')
            if (savedAccountsJson) {
              savedAccounts = JSON.parse(savedAccountsJson)
            }

            // Add the previous user to the saved accounts if not already there
            if (!savedAccounts.some(account => account.uid === prevUser.uid)) {
              savedAccounts.push({
                ...prevUser,
                isCurrent: false
              })
            }

            // Add the new user to the saved accounts
            const newUser = {
              uid: result.user.uid,
              email: result.user.email,
              username: result.user.displayName || email.split('@')[0],
              isCurrent: true
            }

            // Update all accounts to not be current
            savedAccounts = savedAccounts.map(account => ({
              ...account,
              isCurrent: false
            }))

            // Add the new user if not already in the list
            if (!savedAccounts.some(account => account.uid === newUser.uid)) {
              savedAccounts.push(newUser)
            }

            // Save the updated accounts list
            localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts))

            // Clear the previous user session from both storage types
            localStorage.removeItem('previousUserSession')
            sessionStorage.removeItem('wewrite_previous_user')

            // Clear the adding account flags
            localStorage.removeItem('addingNewAccount')
            sessionStorage.removeItem('wewrite_adding_account')
          } catch (error) {
            console.error("Error handling account switching:", error)
          }
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
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err?.message || "An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-4 sm:gap-6", className)}
      {...props}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Log in</h1>
      </div>
      <div className="grid gap-4 sm:gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-foreground text-sm sm:text-base">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="thomaspaine@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

        <Button
          type="submit"
          className={cn(
            "w-full transition-all h-10 sm:h-11 mt-2",
            !isFormValid && !isLoading ?
              "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : ""
          )}
          disabled={isLoading || !isFormValid}
          tabIndex={4}
        >
          {isLoading ? "Signing in..." : "Login"}
        </Button>
      </div>
      <div className="text-center text-sm sm:text-base text-muted-foreground mt-2">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="underline underline-offset-4 text-foreground hover:text-foreground/90 font-medium" tabIndex={5}>
          Sign up
        </Link>
      </div>

      {previousAccount && (
        <Button
          type="button"
          variant="outline"
          className="w-full mt-4 bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200"
          onClick={() => {
            // Clear the adding account flags
            localStorage.removeItem('addingNewAccount');
            sessionStorage.removeItem('wewrite_adding_account');

            // Redirect to home page
            window.location.href = '/';
          }}
        >
          Return to {previousAccount.email}
        </Button>
      )}
    </form>
  )
}
