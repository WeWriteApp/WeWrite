import { User } from "@/providers/AuthProvider";
import { faUserAlt, faUserAltSlash, faUserCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import React, { createContext, useState, useEffect, ReactNode } from "react";



interface UserLinkProps {
  href?: string,
  children?: any;
  user?: User;
  groupId?: string;
  className?: string;
}

const UserLink: React.FC<UserLinkProps> = ({ children, href, user, groupId, className }) => {

  return (
    <Link href={`/users/profile/${user?.uid}`} className={`badge-shadow flex items-center gap-4 pl-2 pr-6 py-1 rounded-xl ${className}`}>
      <FontAwesomeIcon icon={faUserCircle} size="1x"/>
      <p className="">{user?.username}</p>
    </Link>
  )
}

export default UserLink