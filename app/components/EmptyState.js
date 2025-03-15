"use client";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";

const EmptyState = ({ 
  title, 
  description, 
  icon,
  actionLabel,
  actionHref,
  className = ""
}) => {
  return (
    <div className="flex justify-center py-8">
      <div className={`
        relative 
        bg-background 
        border-2 
        border-dashed 
        border-white/20 
        rounded-[24px] 
        p-8 
        max-w-md 
        w-full 
        text-center
        ${className}
      `}>
        {icon && (
          <Icon 
            icon={icon} 
            className="text-4xl mx-auto mb-4 text-text/60" 
          />
        )}
        <div className="text-text text-xl mb-4">
          {title}
        </div>
        <div className="text-text/60 mb-6">
          {description}
        </div>
        {actionLabel && actionHref && (
          <Link 
            href={actionHref} 
            className="
              inline-block
              bg-[#0057FF]
              text-white 
              text-sm 
              font-medium
              px-6 
              py-2.5
              rounded-full
              hover:bg-[#0046CC]
              transition-colors 
              duration-150
              shadow-[0_0_12px_rgba(0,87,255,0.4)]
            "
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState; 