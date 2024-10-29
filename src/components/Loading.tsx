"use client"

import { AppContext } from "@/providers/AppProvider"
import { Spinner } from "@nextui-org/react"
import { useContext } from "react"

const Loader = () => {
  const { loading } = useContext(AppContext)

  if (loading)
    return (
        loading?
          <div className = "fixed top-0 bottom-0 left-0 right-0 z-max">
        < Spinner size = "lg" color = "primary" />
      </div >
      : <></>
    )
}


export default Loader