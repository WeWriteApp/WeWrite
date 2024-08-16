import React, { useState, useEffect, useContext } from "react";
import Link from "next/link";

export const PillLink = ({ children, href }) => {
  return (
    <Link href={href} className="bg-red-500 mx-1 my-1 text-white px-4 py-2 rounded-full inline-block">
      {children}
    </Link>
  );
}
