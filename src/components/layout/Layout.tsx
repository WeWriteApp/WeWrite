'use client'

import { useContext } from "react"
import Loader from "../Loading"
import Navbar from "./Navbar"
import { ThemeContext } from "@/providers/ThemeProvider"


const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const { theme } = useContext(ThemeContext)
  return (
    <main className={`dark text-foreground bg-background min-h-screen`}>
      <Navbar />
      <Loader />
    </main>
  )
}

export default Layout