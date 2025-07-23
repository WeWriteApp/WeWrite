"use client"

import * as React from "react"
import { AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport} from "./toast"
import { useToast } from "./use-toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const toasterContent = (
    <ToastProvider>
      <ToastViewport>
        <AnimatePresence>
          {toasts.map(function ({ id, title, description, action, ...props }) {
            return (
              <Toast key={id} {...props}>
                <div className="grid gap-1">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && (
                    <ToastDescription>{description}</ToastDescription>
                  )}
                </div>
                {action}
                <ToastClose onClose={() => dismiss(id)} />
              </Toast>
            )
          })}
        </AnimatePresence>
      </ToastViewport>
    </ToastProvider>
  )

  return createPortal(toasterContent, document.body)
}