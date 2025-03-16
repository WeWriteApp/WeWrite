"use client"

import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = ({ 
  className = "", 
  variant = "secondary", 
  size = "default", 
  ...props 
}: ButtonProps) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  const variantClasses = {
    default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
    secondary: "border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
  }
  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-9 w-9"
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button className={classes} {...props} />
  )
}

export default Button 