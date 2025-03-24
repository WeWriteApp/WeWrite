"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState, useEffect } from "react"
import { createUser, addUsername, checkUsernameAvailability } from "../firebase/auth"
import { Check, X } from "lucide-react"
import { debounce } from "lodash"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"

export function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Username validation states
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [validationMessage, setValidationMessage] = useState<string>("")

  // Function to check username availability
  const checkUsername = async (username: string) => {
    if (!username || username.length < 3) {
      setIsAvailable(null)
      setValidationMessage("")
      return
    }

    setIsChecking(true)
    const result = await checkUsernameAvailability(username)
    setIsAvailable(result.isAvailable)
    setValidationMessage(result.message)
    setIsChecking(false)
  }

  // Debounce the username check to avoid too many requests
  const debouncedCheck = debounce(checkUsername, 500)

  // Check username availability when username changes
  useEffect(() => {
    if (username) {
      debouncedCheck(username)
    } else {
      setIsAvailable(null)
      setValidationMessage("")
    }
    
    return () => debouncedCheck.cancel()
  }, [username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
    // Validate username availability before submission
    if (username && !isAvailable) {
      setError(validationMessage || "Please choose a different username")
      setIsLoading(false)
      return
    }
    
    try {
      const result = await createUser(email, password)
      
      if (result.user) {
        // Successfully created user, now add username
        const usernameResult = await addUsername(result.user.uid, username)
        
        if (usernameResult.success) {
          // Successfully added username
          router.push("/")
        } else {
          setError("Account created but failed to set username. Please update your profile.")
        }
      } else {
        // Error handling
        const errorCode = result.code || ""
        let errorMessage = "Failed to create account. Please try again."
        
        if (errorCode.includes("email-already-in-use")) {
          errorMessage = "Email is already in use"
        } else if (errorCode.includes("weak-password")) {
          errorMessage = "Password is too weak, please use at least 6 characters"
        } else if (errorCode.includes("invalid-email")) {
          errorMessage = "Email address is invalid"
        }
        
        setError(errorMessage)
      }
    } catch (err) {
      console.error("Registration error:", err)
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
        <h1 className="text-2xl font-bold text-white !text-white">Create account</h1>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="username" className="text-white !text-white">Username</Label>
          <div className="relative">
            <Input 
              id="username" 
              type="text" 
              placeholder="thomaspaine" 
              required 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              tabIndex={1}
              className="bg-white/10 border-white/20 text-white !text-white placeholder:text-white/50 [&>*]:text-white pr-10"
              style={{color: 'white'}}
            />
            {username && username.length >= 3 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isChecking ? (
                  <div className="h-6 w-6 rounded-full border-2 border-white/30 border-t-transparent animate-spin"></div>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center justify-center h-6 w-6 rounded-full",
                          isAvailable 
                            ? "bg-green-500" 
                            : "bg-red-500"
                        )}>
                          {isAvailable ? (
                            <Check className="h-4 w-4 text-white stroke-[3]" />
                          ) : (
                            <X className="h-4 w-4 text-white stroke-[3]" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{validationMessage}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
          {username && username.length < 3 && (
            <p className="text-xs text-white/70">Username must be at least 3 characters</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-white !text-white">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="thomaspaine@example.com" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            tabIndex={2}
            className="bg-white/10 border-white/20 text-white !text-white placeholder:text-white/50 [&>*]:text-white"
            style={{color: 'white'}}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-white !text-white">Password</Label>
          <Input 
            id="password" 
            type="password" 
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            tabIndex={3}
            className="bg-white/10 border-white/20 text-white !text-white placeholder:text-white/50 [&>*]:text-white"
            style={{color: 'white'}}
          />
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <Button 
          disabled={isLoading || (username && !isAvailable)} 
          className="bg-white hover:bg-white/90 text-black !text-black"
          tabIndex={4}
          type="submit"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
        <div className="text-center">
          <p className="text-sm text-white/70">
            Already have an account?{" "}
            <Link 
              href="/auth/login" 
              className="text-white underline-offset-4 hover:underline"
              tabIndex={5}
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </form>
  )
}
