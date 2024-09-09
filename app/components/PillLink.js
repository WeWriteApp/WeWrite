import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";

export const PillLink = ({ children, href, isPublic, groupId }) => {
  return (
    <Link href={href} className={`${!groupId ? "bg-primary" : "bg-blue-400"} my-1 text-white px-3 py-2 space-x-1 rounded-full inline-block`}>
      {
        !isPublic ? (
          <Icon icon="akar-icons:lock-on" className="mr-2 inline" />
        ) : (
          null
        )
      }
      
      {children}
    </Link>
  );
}