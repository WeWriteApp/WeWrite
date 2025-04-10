import React from "react";

const Button = ({ children, onClick, disabled, type = "primary", variant = "default", className = "" }) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 shadow-sm [&_svg]:size-4 [&_svg]:shrink-0";

  const pillStyles = `
    inline-flex items-center justify-center
    bg-[#0057FF]
    border-[1.5px] border-[rgba(255,255,255,0.3)]
    text-white
    text-base
    px-4 py-2
    rounded-[14px]
    hover:bg-[#0046CC]
    hover:border-[rgba(255,255,255,0.5)]
  `;

  const defaultStyles = type === "secondary"
    ? "bg-secondary text-secondary-foreground py-2 px-4 rounded-md border-theme-medium hover:bg-secondary/80 hover-border-medium"
    : "bg-primary text-primary-foreground py-2 px-4 rounded-md border-[1.5px] border-primary/30 hover:bg-primary/90";

  // Add icon variant support
  const iconStyles = "h-10 w-10 p-0 flex items-center justify-center [&_svg]:size-[18px]";

  // Add specific styling for SVG icons to ensure they're visible
  const enhancedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && child.type === 'svg') {
      return React.cloneElement(child, {
        className: `size-4 stroke-current ${child.props.className || ''}`
      });
    }
    return child;
  });

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variant === "pill" ? pillStyles : variant === "icon" ? iconStyles : defaultStyles}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {enhancedChildren || children}
    </button>
  );
}

export default Button;