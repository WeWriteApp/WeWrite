"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ButtonProps } from "@/components/ui/button";

interface LinkButtonProps extends ButtonProps {
  href: string;
}

export default function LinkButton({ href, ...props }: LinkButtonProps) {
  return (
    <Link href={href} passHref>
      <Button {...props} />
    </Link>
  );
} 