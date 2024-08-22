import React from "react";
import Link from "next/link";

export const PillLink = ({ children, href }) => {
  return (
    <Link href={href} className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 mx-1 my-1 text-white px-4 py-2 rounded-full inline-block transition duration-300 ease-in-out">
      {children}
    </Link>
  );
}