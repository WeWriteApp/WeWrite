"use client"

import { AppContext } from "@/providers/AppProvider"
import { Spinner } from "@nextui-org/react"
import { useContext } from "react"

const Loader = () => {
  const { loading } = useContext(AppContext)

  return (
    <div className={`fixed top-0 bottom-0 left-0 right-0 z-max ${!loading ? "hidden" : ""}`}>
      <Spinner size="lg" color="primary" className="top-1/2 left-1/2 scale-150" />
    </div>
  )
}


export default Loader