import React, { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";

export const PillLink = ({ children, href, isPublic }) => {
  return (
    <Link href={href} className="bg-blue-500 mx-1 my-1 text-white px-4 py-2 space-x-2 rounded-full inline-block">
      {
        isPublic ? (
          <Icon icon="akar-icons:lock-on" className="mr-2 inline" />
        ) : (
          null
        )
      }
      
      {children}
    </Link>
  );
}