"use client";

import Link from "next/link";
import { Icon } from '@/components/ui/Icon';
import { Button as ShadcnButton } from "../ui/button";

interface MarketingButtonProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  type?: "primary" | "secondary";
  href?: string;
}

const Button = ({
  text = "Get in touch",
  size = "md",
  type = "primary",
  href = "#"}: MarketingButtonProps) => {
  // Map marketing button sizes to shadcn sizes
  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  
  return (
    <ShadcnButton 
      variant={type === "primary" ? "default" : "secondary"}
      size={buttonSize}
      className="rounded-full bg-white text-black hover:bg-white/90"
      asChild
    >
      <Link href={href} className="flex items-center gap-2">
        {text}
        <Icon name="ArrowRight" size={20} />
      </Link>
    </ShadcnButton>
  );
};

export default Button;