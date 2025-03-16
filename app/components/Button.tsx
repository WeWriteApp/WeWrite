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
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors"
  const variantClasses = {
    default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
  }
  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-10 rounded-md px-3",
    lg: "h-10 rounded-md px-8",
    icon: "h-10 w-10"
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button className={classes} {...props} />
  )
}

export default Button 