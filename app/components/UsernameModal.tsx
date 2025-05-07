"use client"

import { useState, useEffect } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { debounce } from 'lodash'
import { checkUsernameAvailability } from '../firebase/auth'
import { cn } from '../lib/utils'

interface UsernameModalProps {
  isOpen: boolean
  onClose: () => void
  email: string | null
  onUsernameSet: (username: string) => void
}

export function UsernameModal({ isOpen, onClose, email, onUsernameSet }: UsernameModalProps) {
  const [username, setUsername] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [validationMessage, setValidationMessage] = useState<string>("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([])

  const checkUsername = async (username: string) => {
    if (!username || username.length < 3) {
      setIsAvailable(null)
      setValidationMessage("")
      setValidationError(null)
      setUsernameSuggestions([])
      return
    }

    setIsChecking(true)
    try {
      const result = await checkUsernameAvailability(username)

      if (typeof result === 'boolean') {
        // Handle legacy boolean response
        setIsAvailable(result)
        if (!result) {
          setValidationError("USERNAME_TAKEN")
          setValidationMessage("Username already taken")
        } else {
          setValidationError(null)
          setValidationMessage("")
        }
        setUsernameSuggestions([])
      } else {
        // Handle new object response
        setIsAvailable(result.isAvailable)
        setValidationMessage(result.message || "")
        setValidationError(result.error || null)

        // Set username suggestions if available
        if (result.suggestions && Array.isArray(result.suggestions)) {
          setUsernameSuggestions(result.suggestions)
        } else {
          setUsernameSuggestions([])
        }
      }
    } catch (error) {
      console.error("Error checking username:", error)
      setIsAvailable(false)
      setValidationMessage("Error checking username availability")
      setValidationError("CHECK_ERROR")
      setUsernameSuggestions([])
    } finally {
      setIsChecking(false)
    }
  }

  const debouncedCheck = debounce(checkUsername, 500)

  useEffect(() => {
    if (username) {
      debouncedCheck(username)
    }
    return () => debouncedCheck.cancel()
  }, [username])

  // Handle clicking on a username suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion)
    // Immediately check the availability of the suggested username
    debouncedCheck.cancel()
    checkUsername(suggestion)
  }

  const handleSubmit = async () => {
    if (!isAvailable || !username || !email) return

    try {
      // Save username
      await setDoc(doc(db, 'usernames', username.toLowerCase()), {
        email,
        username,
        createdAt: new Date().toISOString()
      })

      onUsernameSet(username)
      onClose()
    } catch (error) {
      console.error('Error saving username:', error)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 p-4 sm:p-6" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-4 sm:p-5 rounded-lg shadow-lg z-50 w-[calc(100%-2rem)] max-w-md mx-auto my-4 sm:my-6">
        <h2 className="text-xl font-semibold mb-4">Choose your username</h2>
        <div className="relative">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="w-full p-2 border rounded-md pr-10"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isChecking ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
            ) : username && username.length >= 3 ? (
              isAvailable ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <X className="h-5 w-5 text-red-500" />
              )
            ) : null}
          </div>
        </div>
        {username && username.length < 3 && (
          <p className="text-sm text-muted-foreground mt-2">Username must be at least 3 characters</p>
        )}
        {username && !isAvailable && !isChecking && (
          <div className="mt-2">
            <p className="text-sm text-red-500">{validationMessage || "This username is not available"}</p>

            {/* Username suggestions */}
            {validationError === "USERNAME_TAKEN" && usernameSuggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-foreground mb-2">Try one of these instead:</p>
                <div className="flex flex-wrap gap-2">
                  {usernameSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-background border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isAvailable || !username || username.length < 3}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </>
  )
}