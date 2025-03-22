"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { useState } from "react"
import { createUser, addUsername } from "../firebase/auth"

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
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
        <h1 className="text-2xl font-bold text-white !text-white">Create your account</h1>
        <p className="text-balance text-sm text-white/70 !text-white/70">
          Enter your information below to create your account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="username" className="text-white !text-white">Username</Label>
          <Input 
            id="username" 
            type="text" 
            placeholder="yourusername" 
            required 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-white/10 border-white/20 text-white !text-white placeholder:text-white/50 [&>*]:text-white"
            style={{color: 'white'}}
          />
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
            className="bg-white/10 border-white/20 text-white !text-white placeholder:text-white/50 [&>*]:text-white"
            style={{color: 'white'}}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-white !text-white">Password</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••"
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white/10 border-white/20 text-white !text-white placeholder:text-white/50 [&>*]:text-white"
            style={{color: 'white'}}
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
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </div>
      <div className="text-center text-sm text-white/80 !text-white/80">
        Already have an account?{" "}
        <Link href="/auth/login" className="underline underline-offset-4 text-white !text-white hover:text-white/90">
          Sign in
        </Link>
      </div>
    </form>
  )
}
