"use client"

import * as React from "react"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export default function TotalSearch() {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search pages, groups, and users..."
        className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <FontAwesomeIcon
        icon={faSearch}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50"
      />
    </div>
  )
}