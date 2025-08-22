"use client"

import * as React from "react"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Input } from "../ui/input"

export default function TotalSearch() {
  return (
    <div className="relative">
      <Input
        type="text"
        placeholder="Search pages, groups, and users..."
        className="w-full wewrite-input-with-left-icon"
      />
      <FontAwesomeIcon
        icon={faSearch}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}