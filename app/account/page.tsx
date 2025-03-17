"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendPasswordResetEmail } from 'firebase/auth'
import { getUsernameByEmail } from '../firebase/database'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true)
        const { auth } = await import('@/firebase/config')
        
        const currentUser = auth.currentUser
        if (!currentUser) {
          router.push('/auth/login')
          return
        }

        setUser(currentUser)

        // Fetch username using the dedicated function
        if (currentUser.email) {
          const foundUsername = await getUsernameByEmail(currentUser.email)
          setUsername(foundUsername)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [router])

  const handleResetPassword = async () => {
    if (!user?.email) return
    
    try {
      const { auth } = await import('@/firebase/config')
      await sendPasswordResetEmail(auth, user.email)
      setResetSent(true)
    } catch (error) {
      console.error('Error sending password reset:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="h-8 w-8 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
      
      <div className="bg-background border rounded-lg p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <div className="p-2 bg-muted rounded-md">
              {user?.email}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <div className="p-2 bg-muted rounded-md">
              {username || 'No username set'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="p-2 bg-muted rounded-md">
              ••••••••••••
            </div>
            <button 
              onClick={handleResetPassword}
              className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              disabled={resetSent}
            >
              {resetSent ? 'Reset Email Sent' : 'Reset Password'}
            </button>
            {resetSent && (
              <p className="text-sm text-green-600 mt-2">
                Password reset email has been sent to your inbox.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 