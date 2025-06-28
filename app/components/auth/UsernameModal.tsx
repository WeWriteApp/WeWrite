"use client"

import { useState, useEffect } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { debounce } from 'lodash'
import { checkUsernameAvailability } from '../../firebase/auth'
import { cn } from '../../lib/utils'
import { validateUsernameFormat, getUsernameErrorMessage, suggestCleanUsername } from '../../utils/usernameValidation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

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
    if (!username) {
      setIsAvailable(null)
      setValidationMessage("")
      setValidationError(null)
      setUsernameSuggestions([])
      return
    }

    // First, validate format client-side
    const formatValidation = validateUsernameFormat(username)
    if (!formatValidation.isValid) {
      setIsAvailable(false)
      setValidationError(formatValidation.error)
      setValidationMessage(formatValidation.message || "")

      // If it contains whitespace, suggest a cleaned version
      if (formatValidation.error === "CONTAINS_WHITESPACE") {
        const cleanSuggestion = suggestCleanUsername(username)
        if (cleanSuggestion && cleanSuggestion !== username) {
          setUsernameSuggestions([cleanSuggestion])
        }
      } else {
        setUsernameSuggestions([])
      }
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-lg border-theme-strong bg-card animate-in fade-in-0 zoom-in-95 duration-300 px-6 py-6">
        <DialogClose asChild>
          <Button variant="outline" size="icon" className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        <DialogHeader>
          <DialogTitle>Choose your username</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="relative mb-4">
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className={cn(
                "pr-10",
                !isAvailable && username.length >= 3 && !isChecking && "border-red-500",
                isAvailable && username.length >= 3 && !isChecking && "border-green-500"
              )}
              minLength={3}
              maxLength={30}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : username && username.length >= 3 ? (
                isAvailable ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-red-500" />
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
              {(validationError === "USERNAME_TAKEN" || validationError === "CONTAINS_WHITESPACE") && usernameSuggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-foreground mb-2">
                    {validationError === "CONTAINS_WHITESPACE" ? "Try this instead:" : "Try one of these instead:"}
                  </p>
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
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-border dark:border-neutral-700">
          <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isAvailable || !username || username.length < 3}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}