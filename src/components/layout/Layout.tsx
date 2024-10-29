'use client'

import { useContext } from "react"
import Loader from "../Loading"
import Navbar from "./Navbar"
import { ThemeContext } from "@/providers/ThemeProvider"
import SettingsModal from "../modal/Settings"


const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const { theme } = useContext(ThemeContext)

  return (
    <main className={`dark text-foreground bg-background min-h-screen`}>
      <Navbar />
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
        {children}
      </div>
    </main>
  )
}

export default Layout