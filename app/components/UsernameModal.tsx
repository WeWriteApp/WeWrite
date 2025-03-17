"use client"

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { debounce } from 'lodash'

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

  const checkUsername = async (username: string) => {
    if (!username || username.length < 3) {
      setIsAvailable(null)
      return
    }

    setIsChecking(true)
    const userDoc = doc(db, 'usernames', username.toLowerCase())
    const docSnap = await getDoc(userDoc)
    setIsAvailable(!docSnap.exists())
    setIsChecking(false)
  }

  const debouncedCheck = debounce(checkUsername, 500)

  useEffect(() => {
    if (username) {
      debouncedCheck(username)
    }
    return () => debouncedCheck.cancel()
  }, [username])

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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-lg z-50 w-[90%] max-w-md">
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
          <p className="text-sm text-red-500 mt-2">This username is not available</p>
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