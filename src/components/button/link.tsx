import Link from "next/link";
import React, { createContext, useState, useEffect, ReactNode } from "react";

interface LinkButtonProps {
  href: string,
  children: any;
  isPublic?: boolean;
  groupId?: string;
  className?: string;
}

const LinkButton: React.FC<LinkButtonProps> = ({ children, href, isPublic, groupId, className }) => {

  return (
    <Link href={href} className={`badge-shadow px-6 py-1 rounded-xl ${className}`}>
      {children}
    </Link>
  )
}

export default LinkButton